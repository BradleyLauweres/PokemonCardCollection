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

export async function backupCollection(setId = null) {
  const targetSet = (setId && setId !== 'all' && setId !== 'all_owned' && setId !== 'wanted_list') ? setId : null;

  // 1. Try server endpoint first
  try {
    let url = `${API_BASE}/collection/backup/`;
    if (targetSet) {
      url += `?set_id=${encodeURIComponent(targetSet)}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend backup endpoint unavailable, falling back to direct collection export:', err);
  }

  // 2. Resilient fallback: fetch all collection cards and format .txt directly
  try {
    const cards = await fetchUserCollection(targetSet);
    const scopeName = targetSet || 'all_sets';

    const lines = [
      `# PokéTrack TCG Collection Backup`,
      `# Scope: ${scopeName}`,
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

    const content = lines.join('\n') + '\n';
    return {
      message: `Backup created with ${cards.length} cards for ${scopeName}`,
      filename: `backup_${scopeName}.txt`,
      file_path: `backup_${scopeName}.txt`,
      total_cards: cards.length,
      content
    };
  } catch (fallbackErr) {
    console.error('Failed to create collection backup:', fallbackErr);
    throw new Error('Failed to retrieve collection cards for backup');
  }
}

export async function restoreCollection({ file = null, content = null, setId = null } = {}) {
  let txtContent = content;
  if (file && !txtContent) {
    txtContent = await file.text();
  }

  if (!txtContent) {
    throw new Error('No backup file or text content provided');
  }

  // 1. Try server restore endpoint first
  try {
    let res;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      res = await fetch(`${API_BASE}/collection/restore/`, {
        method: 'POST',
        body: formData
      });
    } else {
      res = await fetch(`${API_BASE}/collection/restore/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: txtContent, set_id: setId })
      });
    }
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend restore endpoint unavailable, falling back to direct card sync:', err);
  }

  // 2. Resilient fallback: parse backup text directly in browser and restore via existing API
  const lines = txtContent.trim().split('\n');
  let restoredCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

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

      const cardPayload = {
        card_id: cardId,
        set_id: cardSetId,
        name,
        number,
        rarity,
        image_url: imageUrl,
        market_price: marketPrice
      };

      try {
        if (qty > 0) {
          await toggleCardOwnership(cardPayload);
          if (qty > 1) {
            await updateCardQuantity(cardId, qty);
          }
        }
        if (isWanted) {
          await toggleWantedCard(cardPayload);
        }
        if (customPrice > 0 || notes) {
          await updateCardPrice(cardId, customPrice, notes);
        }
        restoredCount++;
      } catch (e) {
        console.warn(`Failed restoring card ${cardId}:`, e);
      }
    }
  }

  return {
    message: `Successfully restored ${restoredCount} cards into database`,
    restored_count: restoredCount
  };
}

