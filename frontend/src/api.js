/**
 * API client for PokéTrack TCG (Client-Side & GitHub Sync Edition).
 * 
 * - Pokémon Sets & Cards: Fetched directly from Pokémon TCG API (with local caching & seed fallbacks).
 * - Collection Storage: Managed via `githubStorage.js` (reads/commits `collection.json` to GitHub repo,
 *   with instant LocalStorage caching).
 * - No backend or database server required.
 */

import {
  loadCollection,
  saveCards,
  getGitHubConfig,
  saveGitHubConfig,
  getSyncState,
  subscribeSyncState,
  subscribeRemoteUpdates,
  pushToGitHub,
  pullFromGitHub,
  startBackgroundSync,
  testGitHubConnection,
  isGitHubConfigured
} from './githubStorage';

export {
  getGitHubConfig,
  saveGitHubConfig,
  getSyncState,
  subscribeSyncState,
  subscribeRemoteUpdates,
  pushToGitHub,
  pullFromGitHub,
  startBackgroundSync,
  testGitHubConnection,
  isGitHubConfigured
};

const POKEMON_TCG_API_BASE = 'https://api.pokemontcg.io/v2';

/**
 * Fetch all Pokémon sets.
 * Tries live Pokémon TCG API first, then localStorage cache, then bundled ./data/seed_sets.json.
 */
export async function fetchSets() {
  const cached = localStorage.getItem('poketrack_tcg_sets');
  const cachedTime = localStorage.getItem('poketrack_tcg_sets_time');
  const oneDay = 24 * 60 * 60 * 1000;

  // If cached within the last 24 hours, return quickly
  if (cached && cachedTime && Date.now() - parseInt(cachedTime, 10) < oneDay) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // Try live Pokémon TCG API
  try {
    const config = getGitHubConfig();
    const headers = { 'Accept': 'application/json' };
    if (config.tcgApiKey) {
      headers['X-Api-Key'] = config.tcgApiKey.trim();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${POKEMON_TCG_API_BASE}/sets`, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        localStorage.setItem('poketrack_tcg_sets', JSON.stringify(data.data));
        localStorage.setItem('poketrack_tcg_sets_time', Date.now().toString());
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Live sets fetch failed or timed out, trying fallback:', err.message);
  }

  // Fallback to existing cache if available
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // Fallback to bundled seed_sets.json
  try {
    const res = await fetch('./data/seed_sets.json');
    if (res.ok) {
      const data = await res.json();
      return data.data || [];
    }
  } catch (fallbackErr) {
    console.error('Failed to load bundled seed_sets.json:', fallbackErr);
  }

  return [];
}

/**
 * Fetch cards for a specific set.
 * Checks sessionStorage cache, then live API, then bundled seed_cards_<setId>.json.
 */
export async function fetchSetCards(setId) {
  if (!setId) return [];

  const cacheKey = `poketrack_cards_${setId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // Try live Pokémon TCG API
  try {
    const config = getGitHubConfig();
    const headers = { 'Accept': 'application/json' };
    if (config.tcgApiKey) {
      headers['X-Api-Key'] = config.tcgApiKey.trim();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(`${POKEMON_TCG_API_BASE}/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=250`, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        sessionStorage.setItem(cacheKey, JSON.stringify(data.data));
        return data.data;
      }
    }
  } catch (err) {
    console.warn(`Live cards fetch for set ${setId} failed or timed out:`, err.message);
  }

  // Fallback to bundled seed card file if available
  try {
    const res = await fetch(`./data/seed_cards_${setId}.json`);
    if (res.ok) {
      const data = await res.json();
      const list = data.data || [];
      if (list.length > 0) {
        sessionStorage.setItem(cacheKey, JSON.stringify(list));
        return list;
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Fetch user collection cards (optionally filtered by set_id or wanted only)
 */
export async function fetchUserCollection(setId = null, wantedOnly = false) {
  const cards = await loadCollection();
  let filtered = [...cards];

  if (setId) {
    filtered = filtered.filter(c => c.set_id === setId);
  }
  if (wantedOnly) {
    filtered = filtered.filter(c => c.is_wanted === true);
  }

  return filtered;
}

/**
 * Toggle card ownership (Owned / Unowned)
 */
export async function toggleCardOwnership(cardData) {
  const cards = await loadCollection();
  const cardId = cardData.card_id;
  if (!cardId) throw new Error('card_id is required');

  const existingIdx = cards.findIndex(c => c.card_id === cardId);
  let updatedCard = null;
  let isOwned = false;

  if (existingIdx >= 0) {
    const existing = cards[existingIdx];
    if ((existing.quantity || 0) > 0) {
      // Currently owned -> mark unowned
      if (existing.is_wanted) {
        existing.quantity = 0;
        updatedCard = { ...existing };
        cards[existingIdx] = updatedCard;
        isOwned = false;
      } else {
        cards.splice(existingIdx, 1);
        isOwned = false;
      }
    } else {
      // Currently unowned (wanted only) -> mark owned
      existing.quantity = 1;
      updatedCard = { ...existing };
      cards[existingIdx] = updatedCard;
      isOwned = true;
    }
  } else {
    // New card entry
    updatedCard = {
      card_id: cardId,
      set_id: cardData.set_id || '',
      name: cardData.name || '',
      number: cardData.number || '',
      rarity: cardData.rarity || '',
      image_url: cardData.image_url || '',
      quantity: 1,
      is_foil: false,
      is_wanted: false,
      market_price: parseFloat(cardData.market_price || 0.0),
      custom_price: 0.0,
      notes: ''
    };
    cards.push(updatedCard);
    isOwned = true;
  }

  saveCards(cards, {
    modifications: [{
      card_id: cardId,
      action: isOwned ? 'set' : (updatedCard?.is_wanted ? 'set' : 'delete'),
      card: updatedCard
    }]
  });
  return {
    owned: isOwned,
    wanted: updatedCard?.is_wanted || false,
    card: updatedCard,
    card_id: cardId
  };
}

/**
 * Toggle card wanted status (Wishlist)
 */
export async function toggleWantedCard(cardData) {
  const cards = await loadCollection();
  const cardId = cardData.card_id;
  if (!cardId) throw new Error('card_id is required');

  const existingIdx = cards.findIndex(c => c.card_id === cardId);
  let updatedCard = null;
  let isWanted = false;

  if (existingIdx >= 0) {
    const existing = cards[existingIdx];
    const newWanted = !existing.is_wanted;
    isWanted = newWanted;
    existing.is_wanted = newWanted;

    if (!newWanted && (existing.quantity || 0) <= 0) {
      cards.splice(existingIdx, 1);
      updatedCard = null;
    } else {
      // Update metadata if missing
      if (cardData.name && !existing.name) existing.name = cardData.name;
      if (cardData.set_id && !existing.set_id) existing.set_id = cardData.set_id;
      if (cardData.number && !existing.number) existing.number = cardData.number;
      if (cardData.rarity && !existing.rarity) existing.rarity = cardData.rarity;
      if (cardData.image_url && !existing.image_url) existing.image_url = cardData.image_url;
      if (cardData.market_price && !existing.market_price) existing.market_price = parseFloat(cardData.market_price || 0.0);
      updatedCard = { ...existing };
      cards[existingIdx] = updatedCard;
    }
  } else {
    // Add wanted card
    isWanted = true;
    updatedCard = {
      card_id: cardId,
      set_id: cardData.set_id || '',
      name: cardData.name || '',
      number: cardData.number || '',
      rarity: cardData.rarity || '',
      image_url: cardData.image_url || '',
      quantity: 0,
      is_foil: false,
      is_wanted: true,
      market_price: parseFloat(cardData.market_price || 0.0),
      custom_price: 0.0,
      notes: ''
    };
    cards.push(updatedCard);
  }

  saveCards(cards, {
    modifications: [{
      card_id: cardId,
      action: updatedCard ? 'set' : 'delete',
      card: updatedCard
    }]
  });
  return {
    wanted: isWanted,
    card: updatedCard,
    card_id: cardId
  };
}

/**
 * Update card quantity
 */
export async function updateCardQuantity(cardId, quantity, cardData = {}) {
  const cards = await loadCollection();
  const qty = parseInt(quantity, 10);
  if (isNaN(qty)) throw new Error('quantity must be an integer');

  const existingIdx = cards.findIndex(c => c.card_id === cardId);
  let updatedCard = null;

  if (qty <= 0) {
    if (existingIdx >= 0) {
      const existing = cards[existingIdx];
      if (existing.is_wanted) {
        existing.quantity = 0;
        updatedCard = { ...existing };
        cards[existingIdx] = updatedCard;
      } else {
        cards.splice(existingIdx, 1);
      }
    }
  } else if (existingIdx >= 0) {
    cards[existingIdx].quantity = qty;
    updatedCard = { ...cards[existingIdx] };
  } else {
    updatedCard = {
      card_id: cardId,
      set_id: cardData.set_id || '',
      name: cardData.name || '',
      number: cardData.number || '',
      rarity: cardData.rarity || '',
      image_url: cardData.image_url || '',
      quantity: qty,
      is_foil: false,
      is_wanted: false,
      market_price: parseFloat(cardData.market_price || 0.0),
      custom_price: 0.0,
      notes: ''
    };
    cards.push(updatedCard);
  }

  saveCards(cards, {
    modifications: [{
      card_id: cardId,
      action: qty <= 0 && (!updatedCard || !updatedCard.is_wanted) ? 'delete' : 'set',
      card: updatedCard
    }]
  });
  return { owned: qty > 0, wanted: updatedCard?.is_wanted || false, card: updatedCard, card_id: cardId };
}

/**
 * Update custom price and notes
 */
export async function updateCardPrice(cardId, customPrice, notes = '') {
  const cards = await loadCollection();
  const existingIdx = cards.findIndex(c => c.card_id === cardId);

  if (existingIdx < 0) {
    throw new Error('Card not found in collection');
  }

  if (customPrice !== undefined && customPrice !== null) {
    cards[existingIdx].custom_price = parseFloat(customPrice) || 0.0;
  }
  if (notes !== undefined && notes !== null) {
    cards[existingIdx].notes = notes;
  }

  const updatedCard = { ...cards[existingIdx] };
  saveCards(cards, {
    modifications: [{
      card_id: cardId,
      action: 'set',
      card: updatedCard
    }]
  });
  return { owned: (updatedCard.quantity || 0) > 0, card: updatedCard };
}

/**
 * Bulk action for a set (mark_all or clear_all)
 */
export async function bulkToggleSet(setId, action, setCards = []) {
  const cards = await loadCollection();

  if (action === 'clear_all') {
    const updated = [];
    const modifications = [];
    for (const c of cards) {
      if (c.set_id === setId) {
        if (c.is_wanted) {
          const zeroCard = { ...c, quantity: 0 };
          updated.push(zeroCard);
          modifications.push({ card_id: c.card_id, action: 'set', card: zeroCard });
        } else {
          modifications.push({ card_id: c.card_id, action: 'delete' });
        }
      } else {
        updated.push(c);
      }
    }
    saveCards(updated, { modifications });
    return { message: `Cleared collected cards for set ${setId}` };
  } else if (action === 'mark_all') {
    const cardMap = new Map(cards.map(c => [c.card_id, c]));

    for (const item of setCards) {
      const cId = item.id;
      if (!cId) continue;

      let mPrice = 0.0;
      const cmPrice = item.cardmarket?.prices?.averageSellPrice;
      const tcgPrice = item.tcgplayer?.prices?.holofoil?.market || item.tcgplayer?.prices?.normal?.market;
      if (cmPrice) mPrice = cmPrice;
      else if (tcgPrice) mPrice = tcgPrice;

      if (cardMap.has(cId)) {
        const existing = cardMap.get(cId);
        existing.quantity = Math.max(existing.quantity || 0, 1);
      } else {
        const newCard = {
          card_id: cId,
          set_id: setId,
          name: item.name || '',
          number: item.number || '',
          rarity: item.rarity || '',
          image_url: item.images?.small || '',
          market_price: parseFloat(mPrice || 0.0),
          custom_price: 0.0,
          notes: '',
          quantity: 1,
          is_foil: false,
          is_wanted: false
        };
        cardMap.set(cId, newCard);
      }
    }

    const updated = Array.from(cardMap.values());
    const modifications = updated
      .filter(c => c.set_id === setId)
      .map(c => ({ card_id: c.card_id, action: 'set', card: c }));
    saveCards(updated, { modifications });
    return { message: `Marked set ${setId} cards as collected` };
  }

  throw new Error('Invalid action');
}

/**
 * Compute collection stats and valuation
 */
export async function fetchCollectionStats() {
  const cards = await loadCollection();
  const ownedCards = cards.filter(c => (c.quantity || 0) > 0);
  const wantedCards = cards.filter(c => c.is_wanted === true);

  let totalMarketValue = 0.0;
  let totalCustomValue = 0.0;
  const setCounts = {};
  const setValues = {};

  for (const card of ownedCards) {
    const qty = card.quantity || 1;
    const valM = (card.market_price || 0.0) * qty;
    const valC = (card.custom_price || card.market_price || 0.0) * qty;

    totalMarketValue += valM;
    totalCustomValue += valC;

    if (card.set_id) {
      setCounts[card.set_id] = (setCounts[card.set_id] || 0) + 1;
      setValues[card.set_id] = (setValues[card.set_id] || 0) + valM;
    }
  }

  const totalWantedCost = wantedCards.reduce((sum, c) => sum + (c.market_price || 0.0), 0.0);

  return {
    total_collected: ownedCards.length,
    total_wanted: wantedCards.length,
    total_wanted_cost: Math.round(totalWantedCost * 100) / 100,
    total_sets_tracked: Object.keys(setCounts).length,
    total_market_value: Math.round(totalMarketValue * 100) / 100,
    total_custom_value: Math.round(totalCustomValue * 100) / 100,
    set_counts: setCounts,
    set_values: setValues
  };
}

/**
 * Format collection backup text
 */
function formatBackupTxt(cards, scope = 'all_sets') {
  const lines = [
    `# PokéTrack TCG Collection Backup`,
    `# Scope: ${scope}`,
    `# Total Cards: ${cards.length}`,
    `# Format: card_id | set_id | number | quantity | is_wanted | market_price | custom_price | name | rarity | image_url | notes`
  ];
  for (const c of cards) {
    const name = (c.name || '').replace(/\|/g, ' ');
    const rarity = (c.rarity || '').replace(/\|/g, ' ');
    const notes = (c.notes || '').replace(/\n/g, ' ').replace(/\|/g, ' ');
    const img = c.image_url || '';
    const mPrice = Number(c.market_price || 0).toFixed(2);
    const cPrice = Number(c.custom_price || 0).toFixed(2);
    const wanted = c.is_wanted ? 1 : 0;
    lines.push(`${c.card_id} | ${c.set_id} | ${c.number} | ${c.quantity} | ${wanted} | ${mPrice} | ${cPrice} | ${name} | ${rarity} | ${img} | ${notes}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Parse collection backup text or JSON
 */
function parseBackupContent(txtContent) {
  const trimmed = txtContent.trim();
  if (trimmed.startsWith('[') || (trimmed.startsWith('{') && trimmed.includes('"cards"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : (parsed.cards || []);
    } catch {
      // fallback to txt parser
    }
  }

  const cardsToSave = [];
  const lines = trimmed.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const item = JSON.parse(line);
        if (item.card_id) {
          cardsToSave.push(item);
          continue;
        }
      } catch {
        // ignore
      }
    }

    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 1) {
      const cardId = parts[0];
      if (!cardId) continue;

      const cardSetId = parts[1] || (cardId.includes('-') ? cardId.split('-')[0] : '');
      const number = parts[2] || (cardId.includes('-') ? cardId.split('-')[1] : '');
      const qty = parseInt(parts[3], 10) || 1;
      const isWanted = parts[4] === '1' || parts[4]?.toLowerCase() === 'true';
      const marketPrice = parseFloat(parts[5]) || 0.0;
      const customPrice = parseFloat(parts[6]) || 0.0;
      const name = parts[7] || '';
      const rarity = parts[8] || '';
      const imageUrl = parts[9] || '';
      const notes = parts[10] || '';

      cardsToSave.push({
        card_id: cardId,
        set_id: cardSetId,
        number,
        quantity: qty,
        is_wanted: isWanted,
        market_price: marketPrice,
        custom_price: customPrice,
        name,
        rarity,
        image_url: imageUrl,
        notes
      });
    }
  }

  return cardsToSave;
}

/**
 * Backup collection (exports text or JSON)
 */
export async function backupCollection(setId = null) {
  const cards = await loadCollection();
  const targetSet = (setId && setId !== 'all' && setId !== 'all_owned' && setId !== 'wanted_list') ? setId : null;
  const filtered = targetSet ? cards.filter(c => c.set_id === targetSet) : cards;
  const scopeName = targetSet || 'all_sets';

  const content = formatBackupTxt(filtered, scopeName);
  return {
    message: `Backup created with ${filtered.length} cards for ${scopeName}`,
    filename: `backup_${scopeName}.txt`,
    file_path: `backup_${scopeName}.txt`,
    total_cards: filtered.length,
    content
  };
}

/**
 * Restore collection from file or text content
 */
export async function restoreCollection({ file = null, content = null } = {}) {
  let txtContent = content;
  if (file && !txtContent) {
    txtContent = await file.text();
  }

  if (!txtContent) {
    throw new Error('No backup file or text content provided');
  }

  const parsedCards = parseBackupContent(txtContent);
  if (!parsedCards || parsedCards.length === 0) {
    throw new Error('No valid card records found in backup');
  }

  const current = await loadCollection();
  const cardMap = new Map(current.map(c => [c.card_id, c]));

  for (const card of parsedCards) {
    if (!card.card_id) continue;
    cardMap.set(card.card_id, {
      card_id: card.card_id,
      set_id: card.set_id || '',
      name: card.name || '',
      number: card.number || '',
      rarity: card.rarity || '',
      image_url: card.image_url || '',
      quantity: card.quantity !== undefined ? card.quantity : 1,
      is_foil: card.is_foil || false,
      is_wanted: card.is_wanted || false,
      market_price: parseFloat(card.market_price || 0.0),
      custom_price: parseFloat(card.custom_price || 0.0),
      notes: card.notes || ''
    });
  }

  const merged = Array.from(cardMap.values());
  saveCards(merged, { immediate: true });

  return {
    message: `Successfully restored ${parsedCards.length} cards`,
    restored_count: parsedCards.length
  };
}
