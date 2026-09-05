/**
 * GitHub-backed file storage service for PokéTrack TCG.
 * Handles reading from and committing to `collection.json` in a GitHub repository
 * using the GitHub REST API.
 * 
 * Features:
 * - Multi-user concurrent editing support (card-level 3-way merge & conflict resolution)
 * - Automatic background sync (polling & window focus auto-pull)
 * - Instant local persistence via localStorage (optimistic UI updates with 0ms lag)
 * - Debounced commits to prevent API spam and merge collisions
 * - Automatic 409 conflict handling with re-fetch and re-merge
 * - Resilient offline fallback
 */

const STORAGE_KEY_COLLECTION = 'poketrack_collection';
const STORAGE_KEY_GH_CONFIG = 'poketrack_gh_config';
const STORAGE_KEY_GH_SHA = 'poketrack_gh_sha';
const STORAGE_KEY_LAST_SYNC = 'poketrack_last_sync_time';

export const DEFAULT_GH_CONFIG = {
  owner: 'BradleyLauweres',
  repo: 'PokemonCardCollection',
  branch: 'main',
  path: 'collection.json',
  token: '',
  tcgApiKey: ''
};

// UTF-8 safe Base64 encoding & decoding for browsers
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// In-memory state
let currentCards = null;
let currentSha = localStorage.getItem(STORAGE_KEY_GH_SHA) || null;
let debounceTimer = null;
let isSyncInProgress = false;
let hasQueuedSync = false;

// Pending delta modifications for 3-way merge:
// Map<card_id, { action: 'set' | 'delete', card: Object, timestamp: number }>
const pendingModifications = new Map();

// Sync state: 'unconfigured' | 'idle' | 'pending' | 'syncing' | 'synced' | 'error'
let syncState = {
  status: 'idle',
  lastSyncedAt: localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null,
  lastError: null,
  pendingChangesCount: 0
};

const listeners = new Set();
const remoteUpdateListeners = new Set();

function notifyListeners() {
  const snapshot = { ...syncState };
  listeners.forEach(fn => {
    try {
      fn(snapshot);
    } catch (err) {
      console.error('Error in sync state listener:', err);
    }
  });
}

function notifyRemoteUpdated(cards) {
  remoteUpdateListeners.forEach(fn => {
    try {
      fn(cards);
    } catch (err) {
      console.error('Error in remote update listener:', err);
    }
  });
}

export function subscribeSyncState(fn) {
  listeners.add(fn);
  fn({ ...syncState });
  return () => listeners.delete(fn);
}

export function subscribeRemoteUpdates(fn) {
  remoteUpdateListeners.add(fn);
  return () => remoteUpdateListeners.delete(fn);
}

export function getSyncState() {
  return { ...syncState };
}

export function getGitHubConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GH_CONFIG);
    if (!raw) return { ...DEFAULT_GH_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_GH_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_GH_CONFIG };
  }
}

export function saveGitHubConfig(config) {
  const updated = {
    ...getGitHubConfig(),
    ...config
  };
  localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(updated));
  
  if (!updated.token || !updated.token.trim()) {
    syncState.status = 'unconfigured';
  } else {
    syncState.status = 'idle';
  }
  notifyListeners();
  return updated;
}

export function isGitHubConfigured() {
  const config = getGitHubConfig();
  return !!(config.token && config.token.trim() && config.owner && config.repo);
}

/**
 * Initialize and load the collection:
 * 1. Checks memory cache
 * 2. Checks localStorage
 * 3. If GitHub configured, pulls latest remote collection.json
 * 4. Fallback to bundled ./data/collection.json (initial seed) or raw GitHub
 */
export async function loadCollection({ forceRemote = false } = {}) {
  if (currentCards !== null && !forceRemote) {
    return [...currentCards];
  }

  // Check localStorage first
  let cachedCards = null;
  const localRaw = localStorage.getItem(STORAGE_KEY_COLLECTION);
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        cachedCards = parsed;
      } else if (parsed && Array.isArray(parsed.cards)) {
        cachedCards = parsed.cards;
      }
    } catch (err) {
      console.warn('Failed parsing local collection storage:', err);
    }
  }

  if (cachedCards !== null && !forceRemote) {
    currentCards = cachedCards;
  }

  // If not configured, set status
  if (!isGitHubConfigured()) {
    syncState.status = 'unconfigured';
    notifyListeners();
  }

  // If configured, pull fresh from GitHub
  if (isGitHubConfigured()) {
    try {
      const remoteData = await fetchRemoteGitHubFile();
      if (remoteData && remoteData.cards) {
        // Perform card-level merge if local had modifications
        if (pendingModifications.size > 0 && currentCards) {
          const merged = applyPendingModifications(remoteData.cards);
          currentCards = merged;
        } else {
          currentCards = remoteData.cards;
        }

        currentSha = remoteData.sha;
        localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
        if (currentSha) {
          localStorage.setItem(STORAGE_KEY_GH_SHA, currentSha);
        }
        syncState.status = 'synced';
        syncState.lastSyncedAt = new Date().toISOString();
        syncState.lastError = null;
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncState.lastSyncedAt);
        notifyListeners();
        return [...currentCards];
      }
    } catch (err) {
      console.warn('Could not fetch collection from GitHub on load, using cached:', err);
      syncState.status = 'error';
      syncState.lastError = err.message;
      notifyListeners();
    }
  }

  // If still no cards, load initial seed from ./data/collection.json or raw GitHub
  if (currentCards === null) {
    try {
      const res = await fetch('./data/collection.json');
      if (res.ok) {
        const seed = await res.json();
        const initial = Array.isArray(seed) ? seed : (seed.cards || []);
        currentCards = initial;
        localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
      } else {
        const rawRes = await fetch(`https://raw.githubusercontent.com/${encodeURIComponent(DEFAULT_GH_CONFIG.owner)}/${encodeURIComponent(DEFAULT_GH_CONFIG.repo)}/${encodeURIComponent(DEFAULT_GH_CONFIG.branch)}/${encodeURIComponent(DEFAULT_GH_CONFIG.path)}`);
        if (rawRes.ok) {
          const rawSeed = await rawRes.json();
          currentCards = Array.isArray(rawSeed) ? rawSeed : (rawSeed.cards || []);
          localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
        }
      }
    } catch (err) {
      console.warn('Could not load bundled seed collection:', err);
      try {
        const rawRes = await fetch(`https://raw.githubusercontent.com/${encodeURIComponent(DEFAULT_GH_CONFIG.owner)}/${encodeURIComponent(DEFAULT_GH_CONFIG.repo)}/${encodeURIComponent(DEFAULT_GH_CONFIG.branch)}/${encodeURIComponent(DEFAULT_GH_CONFIG.path)}`);
        if (rawRes.ok) {
          const rawSeed = await rawRes.json();
          currentCards = Array.isArray(rawSeed) ? rawSeed : (rawSeed.cards || []);
          localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
        }
      } catch {
        currentCards = [];
      }
    }
  }

  if (currentCards === null) {
    currentCards = [];
  }

  return [...currentCards];
}

/**
 * Fetch the collection file and SHA from GitHub
 */
async function fetchRemoteGitHubFile() {
  const config = getGitHubConfig();
  if (!config.token || !config.owner || !config.repo) {
    return null;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(config.path)}?ref=${encodeURIComponent(config.branch)}&t=${Date.now()}`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token.trim()}`;
  }

  const res = await fetch(url, { headers, cache: 'no-store' });

  if (res.status === 404) {
    return { cards: null, sha: null };
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.content) {
    return { cards: [], sha: data.sha };
  }

  const decoded = base64ToUtf8(data.content);
  const parsed = JSON.parse(decoded);
  const cards = Array.isArray(parsed) ? parsed : (parsed.cards || []);

  return {
    cards,
    sha: data.sha
  };
}

/**
 * Apply locally pending modifications onto a base card array
 */
function applyPendingModifications(baseCards) {
  const cardMap = new Map(baseCards.map(c => [c.card_id, { ...c }]));

  pendingModifications.forEach((mod, cardId) => {
    if (mod.action === 'delete') {
      cardMap.delete(cardId);
    } else if (mod.action === 'set' && mod.card) {
      cardMap.set(cardId, { ...mod.card });
    }
  });

  return Array.from(cardMap.values());
}

/**
 * Record a local card change and schedule background commit
 */
export function recordCardChange(cardId, action, card = null) {
  pendingModifications.set(cardId, {
    action, // 'set' | 'delete'
    card: card ? { ...card } : null,
    timestamp: Date.now()
  });
}

/**
 * Save updated cards to memory and localStorage, and schedule debounced GitHub commit
 */
export function saveCards(updatedCards, { immediate = false, modifications = null } = {}) {
  currentCards = [...updatedCards];
  try {
    localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
  } catch (err) {
    console.error('Failed to write collection to localStorage:', err);
  }

  if (modifications && Array.isArray(modifications)) {
    for (const m of modifications) {
      if (m.card_id) {
        recordCardChange(m.card_id, m.action || 'set', m.card);
      }
    }
  }

  if (!isGitHubConfigured()) {
    syncState.status = 'unconfigured';
    notifyListeners();
    return;
  }

  syncState.pendingChangesCount = pendingModifications.size || 1;
  syncState.status = 'pending';
  notifyListeners();

  if (immediate) {
    if (debounceTimer) clearTimeout(debounceTimer);
    performGitHubCommit();
  } else {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performGitHubCommit();
    }, 2000); // 2 second debounce
  }
}

/**
 * Performs commit of collection.json to GitHub repository with 3-way concurrent merge
 */
export async function performGitHubCommit() {
  if (!isGitHubConfigured()) {
    syncState.status = 'unconfigured';
    notifyListeners();
    return;
  }

  if (isSyncInProgress) {
    hasQueuedSync = true;
    return;
  }

  isSyncInProgress = true;
  syncState.status = 'syncing';
  notifyListeners();

  const maxAttempts = 3;
  let attempt = 0;
  let commitSuccessful = false;

  while (attempt < maxAttempts && !commitSuccessful) {
    attempt++;
    try {
      const config = getGitHubConfig();

      // 1. Fetch current remote collection & latest SHA from GitHub
      let targetSha = currentSha;
      let remoteCards = null;
      try {
        const remote = await fetchRemoteGitHubFile();
        if (remote) {
          targetSha = remote.sha;
          currentSha = remote.sha;
          remoteCards = remote.cards;
        }
      } catch (fetchErr) {
        console.warn('Could not fetch remote before commit, attempting with known SHA:', fetchErr.message);
      }

      // 2. Multi-User 3-Way Merge:
      // If remote collection exists, take remote as base and apply our pending local changes on top!
      let cardsToCommit = currentCards || [];
      if (remoteCards && Array.isArray(remoteCards)) {
        if (pendingModifications.size > 0) {
          cardsToCommit = applyPendingModifications(remoteCards);
        } else {
          // If no specific pending delta, merge by ID so no remote cards are lost
          const localMap = new Map((currentCards || []).map(c => [c.card_id, c]));
          for (const rCard of remoteCards) {
            if (!localMap.has(rCard.card_id)) {
              localMap.set(rCard.card_id, rCard);
            }
          }
          cardsToCommit = Array.from(localMap.values());
        }

        currentCards = cardsToCommit;
        localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
      }

      // 3. Prepare commit payload
      const contentString = JSON.stringify(cardsToCommit, null, 2);
      const base64Content = utf8ToBase64(contentString);

      const commitPayload = {
        message: `Update Pokémon collection (${cardsToCommit.length} cards)`,
        content: base64Content,
        branch: config.branch || 'main'
      };

      if (targetSha) {
        commitPayload.sha = targetSha;
      }

      const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(config.path)}`;
      
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${config.token.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitPayload)
      });

      // Handle 409 Conflict: someone pushed a commit right before us!
      if (res.status === 409) {
        console.warn(`GitHub SHA conflict (409) on attempt ${attempt}. Re-fetching remote and merging...`);
        // Next loop iteration will fetch the newest remote SHA and re-merge
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `GitHub error ${res.status}: ${res.statusText}`);
      }

      const resData = await res.json();
      if (resData.content && resData.content.sha) {
        currentSha = resData.content.sha;
        localStorage.setItem(STORAGE_KEY_GH_SHA, currentSha);
      }

      // Success! Clear pending local deltas
      pendingModifications.clear();
      commitSuccessful = true;

      syncState.status = 'synced';
      syncState.lastSyncedAt = new Date().toISOString();
      syncState.lastError = null;
      syncState.pendingChangesCount = 0;
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncState.lastSyncedAt);
      notifyListeners();
    } catch (err) {
      console.error(`Failed commit attempt ${attempt}:`, err);
      if (attempt >= maxAttempts) {
        syncState.status = 'error';
        syncState.lastError = err.message;
        notifyListeners();
      }
    }
  }

  isSyncInProgress = false;
  if (hasQueuedSync) {
    hasQueuedSync = false;
    performGitHubCommit();
  }
}

/**
 * Force pull latest from GitHub repository
 */
export async function pullFromGitHub() {
  if (!isGitHubConfigured()) {
    throw new Error('GitHub is not configured. Please enter your repository and token.');
  }

  syncState.status = 'syncing';
  notifyListeners();

  try {
    const remote = await fetchRemoteGitHubFile();
    if (!remote || !remote.cards) {
      throw new Error('File not found in GitHub repository. You can push your current local collection first.');
    }

    // Merge any pending local modifications
    if (pendingModifications.size > 0) {
      currentCards = applyPendingModifications(remote.cards);
    } else {
      currentCards = remote.cards;
    }

    currentSha = remote.sha;
    localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
    if (currentSha) {
      localStorage.setItem(STORAGE_KEY_GH_SHA, currentSha);
    }

    syncState.status = 'synced';
    syncState.lastSyncedAt = new Date().toISOString();
    syncState.lastError = null;
    syncState.pendingChangesCount = pendingModifications.size;
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncState.lastSyncedAt);
    notifyListeners();
    notifyRemoteUpdated(currentCards);
    return currentCards;
  } catch (err) {
    syncState.status = 'error';
    syncState.lastError = err.message;
    notifyListeners();
    throw err;
  }
}

/**
 * Force push current local collection to GitHub repository immediately
 */
export async function pushToGitHub() {
  if (!isGitHubConfigured()) {
    throw new Error('GitHub is not configured. Please enter your repository and token.');
  }
  await performGitHubCommit();
  if (syncState.status === 'error') {
    throw new Error(syncState.lastError || 'Failed to push to GitHub');
  }
  return true;
}

/**
 * Background Auto-Sync Worker:
 * Checks for remote repository changes every 25 seconds and whenever tab regains focus.
 * If new cards were added remotely by another user, automatically updates the local view!
 */
export function startBackgroundSync(onRemoteUpdate) {
  let intervalId = null;

  async function checkRemoteUpdates() {
    if (!isGitHubConfigured() || isSyncInProgress || syncState.status === 'syncing') {
      return;
    }

    // Only run if document is visible to save battery/bandwidth
    if (document.hidden) {
      return;
    }

    try {
      const config = getGitHubConfig();
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${config.token.trim()}`
      };
      
      const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(config.path)}?ref=${encodeURIComponent(config.branch)}&t=${Date.now()}`;
      const res = await fetch(url, { headers, cache: 'no-store' });

      if (res.ok) {
        const data = await res.json();
        const remoteSha = data.sha;

        // If remote SHA changed, another user or device made changes!
        if (remoteSha && remoteSha !== currentSha && data.content) {
          console.log('Detected remote changes from another session! Auto-merging...');
          const decoded = base64ToUtf8(data.content);
          const parsed = JSON.parse(decoded);
          const remoteCards = Array.isArray(parsed) ? parsed : (parsed.cards || []);

          // Merge any pending modifications the local user made
          let mergedCards = remoteCards;
          if (pendingModifications.size > 0) {
            mergedCards = applyPendingModifications(remoteCards);
          }

          currentCards = mergedCards;
          currentSha = remoteSha;
          localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
          localStorage.setItem(STORAGE_KEY_GH_SHA, currentSha);

          syncState.status = 'synced';
          syncState.lastSyncedAt = new Date().toISOString();
          localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncState.lastSyncedAt);
          notifyListeners();

          if (onRemoteUpdate) {
            onRemoteUpdate(currentCards);
          }
          notifyRemoteUpdated(currentCards);
        }
      }
    } catch {
      // Quietly ignore background poll errors
    }
  }

  // Poll every 25 seconds
  intervalId = setInterval(checkRemoteUpdates, 25000);

  // Check immediately when user switches back to this tab
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      checkRemoteUpdates();
    }
  };

  const handleWindowFocus = () => {
    checkRemoteUpdates();
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);

  return () => {
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
  };
}

/**
 * Test the GitHub connection and verify write permissions
 */
export async function testGitHubConnection(configToTest) {
  const config = {
    ...getGitHubConfig(),
    ...configToTest
  };

  if (!config.token || !config.token.trim()) {
    throw new Error('Please provide a GitHub Personal Access Token.');
  }
  if (!config.owner || !config.repo) {
    throw new Error('Please provide both repository owner and repository name.');
  }

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${config.token.trim()}`
  };

  // 1. Check repository access & permissions
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const repoRes = await fetch(repoUrl, { headers });

  if (repoRes.status === 401) {
    throw new Error('Bad credentials: The token is invalid or expired.');
  }
  if (repoRes.status === 404) {
    throw new Error(`Repository "${config.owner}/${config.repo}" was not found, or token does not have access.`);
  }
  if (!repoRes.ok) {
    const body = await repoRes.json().catch(() => ({}));
    throw new Error(body.message || `Failed to access repository (${repoRes.status})`);
  }

  const repoData = await repoRes.json();
  const canPush = repoData.permissions ? repoData.permissions.push : true;

  // 2. Check if the target collection file exists
  const fileUrl = `${repoUrl}/contents/${encodeURIComponent(config.path)}?ref=${encodeURIComponent(config.branch || 'main')}`;
  const fileRes = await fetch(fileUrl, { headers });
  
  let fileExists = false;
  let remoteCardsCount = 0;
  let sha = null;

  if (fileRes.ok) {
    fileExists = true;
    const fileData = await fileRes.json();
    sha = fileData.sha;
    if (fileData.content) {
      try {
        const decoded = base64ToUtf8(fileData.content);
        const parsed = JSON.parse(decoded);
        remoteCardsCount = Array.isArray(parsed) ? parsed.length : (parsed.cards ? parsed.cards.length : 0);
      } catch {
        // ignore content parse
      }
    }
  }

  return {
    ok: true,
    repoName: repoData.full_name,
    canPush,
    fileExists,
    remoteCardsCount,
    sha
  };
}

/**
 * Direct accessor to current cards in memory
 */
export function getCurrentCards() {
  return currentCards || [];
}
