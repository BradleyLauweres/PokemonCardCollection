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
import placeholderImg from './assets/placeholder.png';

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

export const TCGDEX_API_BASE = 'https://api.tcgdex.net/v2/en';

export function formatCardImageUrl(imgUrl) {
  if (!imgUrl) return placeholderImg;
  if (imgUrl.includes('.webp') || imgUrl.includes('.png') || imgUrl.includes('.jpg')) {
    return imgUrl;
  }
  return `${imgUrl}/high.webp`;
}

const EXPLICIT_SET_MAP = {
  'rsv10pt5': 'sv10.5w',
  'me1': 'me01',
  'me2': 'me02',
  'me3': 'me03',
  'me4': 'me04',
  'me5': 'me05',
  'swsh12pt5': 'swsh12.5',
  'swsh12pt5gg': 'swsh12.5gg',
  'swsh45': 'swsh04.5',
  'swsh45sv': 'swsh04.5sv'
};

export function canonicalSetId(raw) {
  if (!raw) return '';
  const s = String(raw).toLowerCase().trim();
  if (EXPLICIT_SET_MAP[s]) return EXPLICIT_SET_MAP[s];
  let converted = s.replace(/pt(\d+)/g, (_, m1) => `.${m1}`);
  converted = converted.replace(/^(sv|me|swsh|sm)(\d)(?!\d)/, (_, m1, m2) => `${m1}0${m2}`);
  return converted;
}

export function normalizeCardNumber(num) {
  if (!num) return '';
  const s = String(num).trim();
  return s.replace(/^([A-Za-z]+)?0*(\d+)/, (_, prefix, digits) => (prefix || '') + digits).toUpperCase();
}

export function getCardMatchKey(setId, num) {
  if (!setId || !num) return null;
  return `${canonicalSetId(setId)}:${normalizeCardNumber(num)}`;
}

export function findUserCardEntry(userCollectionMap, card) {
  if (!card || !userCollectionMap) return null;
  if (card.id && userCollectionMap[card.id]) {
    return userCollectionMap[card.id];
  }
  const sId = card.set?.id || card.set_id;
  const num = card.number || card.localId;
  const k = getCardMatchKey(sId, num);
  if (k && userCollectionMap[k]) {
    return userCollectionMap[k];
  }
  return null;
}

export function formatSetLogoUrl(rawLogo) {
  if (!rawLogo) return undefined;
  let str = String(rawLogo).trim();
  if (!str) return undefined;
  str = str.replace(/\.png$/, '.webp');
  if (!str.endsWith('.webp')) {
    str = `${str}.webp`;
  }
  return str;
}

export function formatSetSymbolUrl(rawSymbol) {
  if (!rawSymbol) return undefined;
  let str = String(rawSymbol).trim();
  if (!str) return undefined;
  str = str.replace('/univ/', '/en/');
  if (!str.endsWith('.png') && !str.endsWith('.webp')) {
    str = `${str}.png`;
  }
  return str;
}

export function normalizeSet(set, seriesName = '') {
  if (!set) return null;
  const logo = formatSetLogoUrl(set.logo || set.images?.logo);
  const symbol = formatSetSymbolUrl(set.symbol || set.images?.symbol);
  return {
    id: set.id,
    name: set.name,
    series: set.series || seriesName || set.serie?.name || 'Other',
    logo,
    symbol,
    total: set.total || set.cardCount?.total || set.cardCount?.official || 0,
    printedTotal: set.printedTotal || set.cardCount?.official || set.cardCount?.total || 0,
    releaseDate: set.releaseDate || '',
    images: {
      logo,
      symbol
    }
  };
}

export async function fetchSets() {
  const cached = localStorage.getItem('poketrack_tcgdex_sets');
  const cachedTime = localStorage.getItem('poketrack_tcgdex_sets_time');
  const oneDay = 24 * 60 * 60 * 1000;

  if (cached && cachedTime && Date.now() - parseInt(cachedTime, 10) < oneDay) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => normalizeSet(s));
      }
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const seriesRes = await fetch(`${TCGDEX_API_BASE}/series`, { signal: controller.signal }).then(r => r.json());
    const seriesDetails = await Promise.all(
      seriesRes.map(s =>
        fetch(`${TCGDEX_API_BASE}/series/${s.id}`, { signal: controller.signal })
          .then(r => r.json())
          .catch(() => ({ id: s.id, name: s.name, sets: [] }))
      )
    );
    clearTimeout(timeoutId);

    const allSets = [];
    for (const s of seriesDetails) {
      for (const set of s.sets || []) {
        allSets.push(normalizeSet(set, s.name));
      }
    }

    if (allSets.length > 0) {
      localStorage.setItem('poketrack_tcgdex_sets', JSON.stringify(allSets));
      localStorage.setItem('poketrack_tcgdex_sets_time', Date.now().toString());
      return allSets;
    }
  } catch {}

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((s) => normalizeSet(s));
    } catch {}
  }

  try {
    const res = await fetch('./data/seed_tcgdex_sets.json');
    if (res.ok) {
      const data = await res.json();
      return (data.data || []).map((s) => normalizeSet(s));
    }
  } catch {}

  return [];
}

async function enrichCardsInBackground(setId, initialCards, onProgress) {
  if (!initialCards || initialCards.length === 0) return;
  const chunkSize = 25;
  const cards = [...initialCards];
  let hasChanges = false;

  for (let i = 0; i < cards.length; i += chunkSize) {
    const slice = cards.slice(i, i + chunkSize);
    try {
      const results = await Promise.all(
        slice.map(c =>
          fetch(`${TCGDEX_API_BASE}/cards/${encodeURIComponent(c.id)}`)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );

      results.forEach((detail, idx) => {
        if (!detail) return;
        const targetIdx = i + idx;
        if (targetIdx < cards.length) {
          const cmAvg = detail.pricing?.cardmarket?.avg ?? detail.pricing?.cardmarket?.trend ?? 0.0;
          const tcgMarket = detail.pricing?.tcgplayer?.holofoil?.marketPrice ?? detail.pricing?.tcgplayer?.normal?.marketPrice ?? 0.0;
          const mPrice = cmAvg || tcgMarket || 0.0;

          cards[targetIdx] = {
            ...cards[targetIdx],
            rarity: detail.rarity || cards[targetIdx].rarity || 'Common',
            supertype: detail.category || cards[targetIdx].supertype,
            market_price: mPrice,
            cardmarket: {
              prices: {
                averageSellPrice: cmAvg,
                lowPrice: detail.pricing?.cardmarket?.low ?? 0.0,
                trendPrice: detail.pricing?.cardmarket?.trend ?? 0.0
              }
            },
            tcgplayer: {
              prices: {
                holofoil: { market: detail.pricing?.tcgplayer?.holofoil?.marketPrice ?? 0.0 },
                normal: { market: detail.pricing?.tcgplayer?.normal?.marketPrice ?? 0.0 }
              }
            }
          };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        sessionStorage.setItem(`poketrack_tcgdex_cards_${setId}`, JSON.stringify(cards));
        if (typeof onProgress === 'function') {
          onProgress([...cards]);
        }
      }
    } catch {}
  }
}

export async function fetchSetCards(setId, onProgress = null) {
  if (!setId) return [];

  const cacheKey = `poketrack_tcgdex_cards_${setId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }

  let cards = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${TCGDEX_API_BASE}/sets/${encodeURIComponent(setId)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const setRes = await res.json();
      if (setRes && Array.isArray(setRes.cards)) {
        cards = setRes.cards.map(c => ({
          id: c.id,
          name: c.name,
          number: c.localId,
          rarity: '',
          supertype: 'Pokémon',
          image_url: c.image ? `${c.image}/low.webp` : placeholderImg,
          images: {
            small: c.image ? `${c.image}/low.webp` : placeholderImg,
            large: c.image ? `${c.image}/high.webp` : placeholderImg
          },
          set: {
            id: setRes.id,
            name: setRes.name,
            series: setRes.serie?.name || ''
          }
        }));

        sessionStorage.setItem(cacheKey, JSON.stringify(cards));
        enrichCardsInBackground(setId, cards, onProgress);
        return cards;
      }
    }
  } catch {}

  const lookupIds = [setId, canonicalSetId(setId), setId.replace('me0', 'me'), setId.replace('sv0', 'sv')];
  for (const testId of lookupIds) {
    try {
      const res = await fetch(`./data/seed_cards_${testId}.json`);
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        if (list.length > 0) {
          sessionStorage.setItem(cacheKey, JSON.stringify(list));
          return list;
        }
      }
    } catch {}
  }

  return cards;
}

export async function searchGlobalCards(query, onProgress = null) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const cacheKey = `poketrack_tcgdex_cards_search_${q}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }

  try {
    const allSets = await fetchSets();
    const setsMap = {};
    for (const s of allSets) {
      if (s.id) setsMap[s.id] = s;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${TCGDEX_API_BASE}/cards?name=${encodeURIComponent(query.trim())}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted = data.map(c => {
          const lastDash = c.id.lastIndexOf('-');
          const sId = lastDash > 0 ? c.id.substring(0, lastDash) : '';
          const setInfo = setsMap[sId];
          return {
            id: c.id,
            name: c.name,
            number: c.localId,
            rarity: '',
            supertype: 'Pokémon',
            image_url: c.image ? `${c.image}/low.webp` : placeholderImg,
            images: {
              small: c.image ? `${c.image}/low.webp` : placeholderImg,
              large: c.image ? `${c.image}/high.webp` : placeholderImg
            },
            set: {
              id: setInfo?.id || sId,
              name: setInfo?.name || sId,
              series: setInfo?.series || ''
            }
          };
        });

        sessionStorage.setItem(cacheKey, JSON.stringify(formatted));
        enrichCardsInBackground(`search_${q}`, formatted, onProgress);
        return formatted;
      }
    }
  } catch {}

  return [];
}

export async function fetchCardDetails(cardId) {
  if (!cardId) return null;

  const cacheKey = `poketrack_tcgdex_detail_${cardId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  try {
    const res = await fetch(`${TCGDEX_API_BASE}/cards/${encodeURIComponent(cardId)}`);
    if (res.ok) {
      const detail = await res.json();
      const cmAvg = detail.pricing?.cardmarket?.avg ?? detail.pricing?.cardmarket?.trend ?? 0.0;
      const tcgMarket = detail.pricing?.tcgplayer?.holofoil?.marketPrice ?? detail.pricing?.tcgplayer?.normal?.marketPrice ?? 0.0;
      const formatted = {
        id: detail.id,
        name: detail.name,
        number: detail.localId,
        rarity: detail.rarity || 'Common',
        supertype: detail.category || 'Pokémon',
        subtypes: detail.stage ? [detail.stage] : [],
        hp: detail.hp ? String(detail.hp) : null,
        artist: detail.illustrator || '',
        description: detail.description || '',
        attacks: detail.attacks || [],
        weaknesses: detail.weaknesses || [],
        image_url: detail.image ? `${detail.image}/high.webp` : placeholderImg,
        images: {
          small: detail.image ? `${detail.image}/low.webp` : placeholderImg,
          large: detail.image ? `${detail.image}/high.webp` : placeholderImg
        },
        market_price: cmAvg || tcgMarket || 0.0,
        cardmarket: {
          prices: {
            averageSellPrice: cmAvg,
            lowPrice: detail.pricing?.cardmarket?.low ?? 0.0,
            trendPrice: detail.pricing?.cardmarket?.trend ?? 0.0
          }
        },
        tcgplayer: {
          prices: {
            holofoil: { market: detail.pricing?.tcgplayer?.holofoil?.marketPrice ?? 0.0 },
            normal: { market: detail.pricing?.tcgplayer?.normal?.marketPrice ?? 0.0 },
            reverseHolofoil: { market: detail.pricing?.tcgplayer?.['reverse-holofoil']?.marketPrice ?? 0.0 }
          }
        },
        set: {
          id: detail.set?.id || '',
          name: detail.set?.name || '',
          series: detail.set?.serie?.name || ''
        }
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(formatted));
      return formatted;
    }
  } catch {}
  return null;
}

export async function fetchUserCollection(setId = null, wantedOnly = false) {
  const cards = await loadCollection();
  let filtered = [...cards];

  if (setId) {
    const cSet = canonicalSetId(setId);
    filtered = filtered.filter(c => c.set_id === setId || canonicalSetId(c.set_id) === cSet);
  }
  if (wantedOnly) {
    filtered = filtered.filter(c => c.is_wanted === true);
  }

  return filtered;
}

export async function toggleCardOwnership(cardData) {
  const cards = await loadCollection();
  const cardId = cardData.card_id;
  if (!cardId) throw new Error('card_id is required');

  const matchKey = getCardMatchKey(cardData.set_id, cardData.number);
  let existingIdx = cards.findIndex(c => c.card_id === cardId);
  if (existingIdx < 0 && matchKey) {
    existingIdx = cards.findIndex(c => getCardMatchKey(c.set_id, c.number) === matchKey);
  }

  let updatedCard = null;
  let isOwned = false;
  let effectiveCardId = cardId;

  if (existingIdx >= 0) {
    const existing = cards[existingIdx];
    effectiveCardId = existing.card_id;

    if ((existing.quantity || 0) > 0) {
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
      existing.quantity = 1;
      updatedCard = { ...existing };
      cards[existingIdx] = updatedCard;
      isOwned = true;
    }
  } else {
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
      card_id: effectiveCardId,
      action: isOwned ? 'set' : (updatedCard?.is_wanted ? 'set' : 'delete'),
      card: updatedCard
    }]
  });

  return {
    owned: isOwned,
    wanted: updatedCard?.is_wanted || false,
    card: updatedCard,
    card_id: effectiveCardId
  };
}

export async function toggleWantedCard(cardData) {
  const cards = await loadCollection();
  const cardId = cardData.card_id;
  if (!cardId) throw new Error('card_id is required');

  const matchKey = getCardMatchKey(cardData.set_id, cardData.number);
  let existingIdx = cards.findIndex(c => c.card_id === cardId);
  if (existingIdx < 0 && matchKey) {
    existingIdx = cards.findIndex(c => getCardMatchKey(c.set_id, c.number) === matchKey);
  }

  let updatedCard = null;
  let isWanted = false;
  let effectiveCardId = cardId;

  if (existingIdx >= 0) {
    const existing = cards[existingIdx];
    effectiveCardId = existing.card_id;
    const newWanted = !existing.is_wanted;
    isWanted = newWanted;
    existing.is_wanted = newWanted;

    if (!newWanted && (existing.quantity || 0) <= 0) {
      cards.splice(existingIdx, 1);
      updatedCard = null;
    } else {
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
      card_id: effectiveCardId,
      action: updatedCard ? 'set' : 'delete',
      card: updatedCard
    }]
  });

  return {
    wanted: isWanted,
    card: updatedCard,
    card_id: effectiveCardId
  };
}

export async function updateCardQuantity(cardId, quantity, cardData = {}) {
  const cards = await loadCollection();
  const qty = parseInt(quantity, 10);
  if (isNaN(qty)) throw new Error('quantity must be an integer');

  const matchKey = getCardMatchKey(cardData.set_id, cardData.number);
  let existingIdx = cards.findIndex(c => c.card_id === cardId);
  if (existingIdx < 0 && matchKey) {
    existingIdx = cards.findIndex(c => getCardMatchKey(c.set_id, c.number) === matchKey);
  }

  let updatedCard = null;
  let effectiveCardId = cardId;

  if (qty <= 0) {
    if (existingIdx >= 0) {
      const existing = cards[existingIdx];
      effectiveCardId = existing.card_id;
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
    effectiveCardId = updatedCard.card_id;
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
      card_id: effectiveCardId,
      action: qty <= 0 && (!updatedCard || !updatedCard.is_wanted) ? 'delete' : 'set',
      card: updatedCard
    }]
  });

  return { owned: qty > 0, wanted: updatedCard?.is_wanted || false, card: updatedCard, card_id: effectiveCardId };
}

export async function updateCardPrice(cardId, customPrice, notes = '', cardData = {}) {
  const cards = await loadCollection();
  const matchKey = getCardMatchKey(cardData.set_id, cardData.number);
  let existingIdx = cards.findIndex(c => c.card_id === cardId);
  if (existingIdx < 0 && matchKey) {
    existingIdx = cards.findIndex(c => getCardMatchKey(c.set_id, c.number) === matchKey);
  }

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
      card_id: updatedCard.card_id,
      action: 'set',
      card: updatedCard
    }]
  });
  return { owned: (updatedCard.quantity || 0) > 0, card: updatedCard };
}

export async function bulkToggleSet(setId, action, setCards = []) {
  const cards = await loadCollection();
  const cSet = canonicalSetId(setId);

  if (action === 'clear_all') {
    const updated = [];
    const modifications = [];
    for (const c of cards) {
      if (c.set_id === setId || canonicalSetId(c.set_id) === cSet) {
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
    const cardMap = new Map();
    cards.forEach(c => {
      cardMap.set(c.card_id, c);
      const k = getCardMatchKey(c.set_id, c.number);
      if (k) cardMap.set(k, c);
    });

    for (const item of setCards) {
      const cId = item.id;
      if (!cId) continue;
      const matchK = getCardMatchKey(setId, item.number || item.localId);

      let mPrice = 0.0;
      const cmPrice = item.cardmarket?.prices?.averageSellPrice;
      const tcgPrice = item.tcgplayer?.prices?.holofoil?.market || item.tcgplayer?.prices?.normal?.market;
      if (cmPrice) mPrice = cmPrice;
      else if (tcgPrice) mPrice = tcgPrice;
      else if (item.market_price) mPrice = item.market_price;

      const existing = cardMap.get(cId) || (matchK ? cardMap.get(matchK) : null);
      if (existing) {
        existing.quantity = Math.max(existing.quantity || 0, 1);
      } else {
        const newCard = {
          card_id: cId,
          set_id: setId,
          name: item.name || '',
          number: item.number || item.localId || '',
          rarity: item.rarity || '',
          image_url: item.images?.small || item.image_url || '',
          market_price: parseFloat(mPrice || 0.0),
          custom_price: 0.0,
          notes: '',
          quantity: 1,
          is_foil: false,
          is_wanted: false
        };
        cards.push(newCard);
        cardMap.set(cId, newCard);
        if (matchK) cardMap.set(matchK, newCard);
      }
    }

    const modifications = cards
      .filter(c => c.set_id === setId || canonicalSetId(c.set_id) === cSet)
      .map(c => ({ card_id: c.card_id, action: 'set', card: c }));
    saveCards(cards, { modifications });
    return { message: `Marked set ${setId} cards as collected` };
  }

  throw new Error('Invalid action');
}

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
      const cId = card.set_id;
      const canonId = canonicalSetId(cId);

      setCounts[cId] = (setCounts[cId] || 0) + 1;
      setValues[cId] = (setValues[cId] || 0) + valM;

      if (canonId && canonId !== cId) {
        setCounts[canonId] = (setCounts[canonId] || 0) + 1;
        setValues[canonId] = (setValues[canonId] || 0) + valM;
      }
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

function parseBackupContent(txtContent) {
  const trimmed = txtContent.trim();
  if (trimmed.startsWith('[') || (trimmed.startsWith('{') && trimmed.includes('"cards"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : (parsed.cards || []);
    } catch {}
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
      } catch {}
    }

    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 1) {
      const cardId = parts[0];
      if (!cardId) continue;

      const cardSetId = parts[1] || (cardId.includes('-') ? cardId.split('-')[0] : '');
      const parsedQty = parseInt(parts[3], 10);
      const qty = isNaN(parsedQty) ? 0 : parsedQty;
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

export async function backupCollection(setId = null) {
  const cards = await loadCollection();
  const targetSet = (setId && setId !== 'all' && setId !== 'all_owned' && setId !== 'wanted_list') ? setId : null;
  const filtered = targetSet
    ? cards.filter(c => c.set_id === targetSet || canonicalSetId(c.set_id) === canonicalSetId(targetSet))
    : cards;
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
