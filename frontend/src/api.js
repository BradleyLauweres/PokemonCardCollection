const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export async function fetchSets() {
  try {
    const res = await fetch(`${API_BASE}/pokemon-tcg/sets/`);
    if (!res.ok) throw new Error('Failed to fetch sets');
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('Error fetching sets:', err);
    return [];
  }
}

export async function fetchSetCards(setId) {
  try {
    const res = await fetch(`${API_BASE}/pokemon-tcg/cards/?set_id=${setId}`);
    if (!res.ok) throw new Error('Failed to fetch cards');
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('Error fetching cards:', err);
    return [];
  }
}

export async function fetchUserCollection(setId = null, wantedOnly = false) {
  try {
    let url = `${API_BASE}/collection/`;
    const params = [];
    if (setId) params.push(`set_id=${setId}`);
    if (wantedOnly) params.push(`wanted=true`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch collection');
    return await res.json();
  } catch (err) {
    console.error('Error fetching user collection:', err);
    return [];
  }
}

export async function toggleCardOwnership(cardData) {
  try {
    const res = await fetch(`${API_BASE}/collection/toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData)
    });
    if (!res.ok) throw new Error('Failed to toggle card');
    return await res.json();
  } catch (err) {
    console.error('Error toggling card:', err);
    throw err;
  }
}

export async function toggleWantedCard(cardData) {
  try {
    const res = await fetch(`${API_BASE}/collection/wanted/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData)
    });
    if (!res.ok) throw new Error('Failed to toggle wanted');
    return await res.json();
  } catch (err) {
    console.error('Error toggling wanted status:', err);
    throw err;
  }
}

export async function updateCardQuantity(cardId, quantity, cardData = {}) {
  try {
    const res = await fetch(`${API_BASE}/collection/quantity/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, quantity, ...cardData })
    });
    if (!res.ok) throw new Error('Failed to update quantity');
    return await res.json();
  } catch (err) {
    console.error('Error updating card quantity:', err);
    throw err;
  }
}

export async function updateCardPrice(cardId, customPrice, notes = '') {
  try {
    const res = await fetch(`${API_BASE}/collection/price/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, custom_price: customPrice, notes })
    });
    if (!res.ok) throw new Error('Failed to update price');
    return await res.json();
  } catch (err) {
    console.error('Error updating price:', err);
    throw err;
  }
}

export async function bulkToggleSet(setId, action, cards = []) {
  try {
    const res = await fetch(`${API_BASE}/collection/bulk-toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set_id: setId, action, cards })
    });
    if (!res.ok) throw new Error('Failed bulk toggle');
    return await res.json();
  } catch (err) {
    console.error('Error in bulk toggle:', err);
    throw err;
  }
}

export async function fetchCollectionStats() {
  try {
    const res = await fetch(`${API_BASE}/collection/stats/`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  } catch (err) {
    console.error('Error fetching stats:', err);
    return { total_collected: 0, total_wanted: 0, total_wanted_cost: 0, total_sets_tracked: 0, total_market_value: 0, total_custom_value: 0, set_counts: {} };
  }
}
