/**
 * GitHub-backed file storage service for PokéTrack TCG.
 * Handles reading from and committing to `collection.json` in a GitHub repository
 * using the GitHub REST API.
 * 
 * Includes:
 * - Instant local persistence via localStorage (optimistic updates)
 * - Automatic debounced commits to GitHub (to respect API limits & prevent merge conflicts)
 * - Offline / tokenless fallback mode (bundling initial 154 cards from seed data)
 * - Conflict resolution and SHA tracking
 * - Live sync state observer for the UI
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

// Sync state: 'unconfigured' | 'idle' | 'pending' | 'syncing' | 'synced' | 'error'
let syncState = {
  status: 'idle',
  lastSyncedAt: localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null,
  lastError: null,
  pendingChangesCount: 0
};

const listeners = new Set();

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

export function subscribeSyncState(fn) {
  listeners.add(fn);
  fn({ ...syncState });
  return () => listeners.delete(fn);
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
 * 4. Fallback to bundled ./data/collection.json (initial seed)
 */
export async function loadCollection() {
  if (currentCards !== null) {
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

  if (cachedCards !== null) {
    currentCards = cachedCards;
  }

  // If not configured, set status
  if (!isGitHubConfigured()) {
    syncState.status = 'unconfigured';
    notifyListeners();
  }

  // If configured, try to pull fresh from GitHub in the background/foreground
  if (isGitHubConfigured()) {
    try {
      const remoteData = await fetchRemoteGitHubFile();
      if (remoteData && remoteData.cards) {
        currentCards = remoteData.cards;
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

  // If still no cards, load initial seed from ./data/collection.json
  if (currentCards === null) {
    try {
      const res = await fetch('./data/collection.json');
      if (res.ok) {
        const seed = await res.json();
        const initial = Array.isArray(seed) ? seed : (seed.cards || []);
        currentCards = initial;
        localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
      }
    } catch (err) {
      console.warn('Could not load bundled seed collection:', err);
      currentCards = [];
    }
  }

  if (currentCards === null) {
    currentCards = [];
  }

  return [...currentCards];
}

/**
 * Fetch the collection file from GitHub
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
    // File doesn't exist yet on remote repo
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
 * Save updated cards to memory and localStorage, and schedule a debounced GitHub commit
 */
export function saveCards(updatedCards, { immediate = false } = {}) {
  currentCards = [...updatedCards];
  try {
    localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
  } catch (err) {
    console.error('Failed to write collection to localStorage:', err);
  }

  if (!isGitHubConfigured()) {
    syncState.status = 'unconfigured';
    notifyListeners();
    return;
  }

  syncState.pendingChangesCount += 1;
  syncState.status = 'pending';
  notifyListeners();

  if (immediate) {
    if (debounceTimer) clearTimeout(debounceTimer);
    performGitHubCommit();
  } else {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performGitHubCommit();
    }, 2500); // 2.5 second debounce
  }
}

/**
 * Performs commit of collection.json to GitHub repository
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

  try {
    const config = getGitHubConfig();
    const cardsToCommit = currentCards || [];
    const contentString = JSON.stringify(cardsToCommit, null, 2);
    const base64Content = utf8ToBase64(contentString);

    // If we don't have current SHA, fetch it first to avoid 409 conflict
    let targetSha = currentSha;
    if (!targetSha) {
      try {
        const remote = await fetchRemoteGitHubFile();
        if (remote && remote.sha) {
          targetSha = remote.sha;
          currentSha = remote.sha;
        }
      } catch {
        // file may be new
      }
    }

    const commitPayload = {
      message: `Update Pokémon collection (${cardsToCommit.length} cards)`,
      content: base64Content,
      branch: config.branch || 'main'
    };

    if (targetSha) {
      commitPayload.sha = targetSha;
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeURIComponent(config.path)}`;
    
    let res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${config.token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commitPayload)
    });

    // Handle 409 Conflict: another push happened or SHA was stale
    if (res.status === 409) {
      console.warn('GitHub SHA conflict (409), re-fetching current SHA and retrying commit...');
      const freshRemote = await fetchRemoteGitHubFile();
      if (freshRemote && freshRemote.sha) {
        commitPayload.sha = freshRemote.sha;
        currentSha = freshRemote.sha;
        res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${config.token.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(commitPayload)
        });
      }
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

    syncState.status = 'synced';
    syncState.lastSyncedAt = new Date().toISOString();
    syncState.lastError = null;
    syncState.pendingChangesCount = 0;
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncState.lastSyncedAt);
    notifyListeners();
  } catch (err) {
    console.error('Failed to commit collection to GitHub:', err);
    syncState.status = 'error';
    syncState.lastError = err.message;
    notifyListeners();
  } finally {
    isSyncInProgress = false;
    if (hasQueuedSync) {
      hasQueuedSync = false;
      performGitHubCommit();
    }
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

    currentCards = remote.cards;
    currentSha = remote.sha;
    localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(currentCards));
    if (currentSha) {
      localStorage.setItem(STORAGE_KEY_GH_SHA, currentSha);
    }

    syncState.status = 'synced';
    syncState.lastSyncedAt = new Date().toISOString();
    syncState.lastError = null;
    syncState.pendingChangesCount = 0;
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncState.lastSyncedAt);
    notifyListeners();
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
