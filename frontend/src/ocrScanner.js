import { createWorker } from 'tesseract.js';
import { TCGDEX_API_BASE, formatCardImageUrl, canonicalSetId } from './api.js';

export const SET_CODE_MAP = {
  // Scarlet & Violet era
  SVI: 'sv01', SV01: 'sv01', SV1: 'sv01',
  PAL: 'sv02', SV02: 'sv02', SV2: 'sv02',
  OBF: 'sv03', SV03: 'sv03', SV3: 'sv03',
  MEW: 'sv03.5', '151': 'sv03.5', SV03PT5: 'sv03.5', SV3PT5: 'sv03.5',
  PAR: 'sv04', SV04: 'sv04', SV4: 'sv04',
  PAF: 'sv04.5', SV04PT5: 'sv04.5', SV4PT5: 'sv04.5',
  TEF: 'sv05', SV05: 'sv05', SV5: 'sv05',
  TWM: 'sv06', SV06: 'sv06', SV6: 'sv06',
  SFA: 'sv06.5', SV06PT5: 'sv06.5', SV6PT5: 'sv06.5',
  SCR: 'sv07', SV07: 'sv07', SV7: 'sv07',
  SSP: 'sv08', SV08: 'sv08', SV8: 'sv08',
  PRE: 'sv08.5', SV08PT5: 'sv08.5', SV8PT5: 'sv08.5',
  JOU: 'sv09', SV09: 'sv09', SV9: 'sv09',
  DRI: 'sv10', SV10: 'sv10',
  WHT: 'sv10.5w', BLK: 'sv10.5b',
  SVP: 'svp', 'PR-SV': 'svp',

  // Sword & Shield era
  SSH: 'swsh1', SWSH1: 'swsh1',
  RCL: 'swsh2', SWSH2: 'swsh2',
  DAA: 'swsh3', SWSH3: 'swsh3',
  CPA: 'swsh3.5', SWSH3PT5: 'swsh3.5',
  VIV: 'swsh4', SWSH4: 'swsh4',
  SHF: 'swsh4.5', SWSH4PT5: 'swsh4.5',
  BST: 'swsh5', SWSH5: 'swsh5',
  CRE: 'swsh6', SWSH6: 'swsh6',
  EVS: 'swsh7', SWSH7: 'swsh7',
  FST: 'swsh8', SWSH8: 'swsh8',
  BRS: 'swsh9', SWSH9: 'swsh9',
  ASR: 'swsh10', SWSH10: 'swsh10',
  PGO: 'swsh10.5',
  LOR: 'swsh11', SWSH11: 'swsh11',
  SIT: 'swsh12', SWSH12: 'swsh12',
  CRZ: 'swsh12.5', SWSH12PT5: 'swsh12.5',
  SWSHP: 'swshp', 'PR-SW': 'swshp',

  // Mega Evolution / other
  ME1: 'me01', ME01: 'me01',
  ME2: 'me02', ME02: 'me02',
  ME3: 'me03', ME03: 'me03',
  ME4: 'me04', ME04: 'me04',
  ME5: 'me05', ME05: 'me05'
};

export const SET_TOTAL_MAP = {
  // Scarlet & Violet printed totals
  '198': 'sv01',
  '193': 'sv02',
  '197': 'sv03',
  '165': 'sv03.5',
  '182': 'sv04',
  '91': 'sv04.5',
  '091': 'sv04.5',
  '162': 'sv05',
  '167': 'sv06',
  '64': 'sv06.5',
  '064': 'sv06.5',
  '142': 'sv07',
  '191': 'sv08',
  '131': 'sv08.5',
  '159': 'sv09',
  '86': 'sv10.5w',

  // Sword & Shield printed totals
  '202': 'swsh1',
  '192': 'swsh2',
  '189': 'swsh3',
  '73': 'swsh3.5',
  '185': 'swsh4',
  '72': 'swsh4.5',
  '163': 'swsh5',
  '203': 'swsh7',
  '264': 'swsh8',
  '172': 'swsh9',
  '78': 'swsh10.5',
  '196': 'swsh11',
  '195': 'swsh12',
  '70': 'swsh12.5gg',
  '30': 'swsh9tg',
  '25': 'cel25'
};

let cachedWorker = null;

export async function getOCRWorker() {
  if (!cachedWorker) {
    cachedWorker = await createWorker('eng');
  }
  return cachedWorker;
}

export function parseCardCode(text, currentSetId = null) {
  if (!text) return null;
  // Normalize whitespace and common OCR separator errors
  let clean = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[|!\\]/g, '/')
    .trim();

  let detectedSetId = null;

  // 1. Look for recognized set abbreviations (e.g. MEW, SVI, PAL, PAR, TEF, TWM, SCR, SSP, PRE, etc.)
  const setCodeMatch = clean.match(/\b(MEW|SVP|TEF|PAF|OBF|SVI|PAL|PAR|TWM|SFA|SCR|SSP|PRE|JOU|DRI|CRZ|SIT|LOR|ASR|PGO|BRS|FST|EVS|CRE|BST|SHF|CPA|VIV|DAA|RCL|SSH|SWSHP?|ME\d{1,2}|SV\d{1,2})\b/i);
  if (setCodeMatch) {
    const code = setCodeMatch[1].toUpperCase();
    if (SET_CODE_MAP[code]) {
      detectedSetId = SET_CODE_MAP[code];
    }
  }

  let cardNumber = null;
  let setTotal = null;

  // 2. Check for standard card fraction: e.g. "025/198", "151/165", "GG04/GG70", "TG01/TG30"
  const slashMatch = clean.match(/(?:EN\s*)?([A-Z]{0,2}\s*[0-9OIl]{1,4})\s*\/\s*([A-Z]{0,2}\s*[0-9OIl]{1,4})/i);
  if (slashMatch) {
    let rawNum = slashMatch[1].replace(/^(EN|FR|DE|IT|ES)/i, '').replace(/\s+/g, '');
    let rawTotal = slashMatch[2].replace(/\s+/g, '');

    // Correct common OCR letter confusions in numbers (e.g. O -> 0, I/l -> 1)
    rawNum = rawNum.replace(/O/gi, '0').replace(/[Il]/g, '1');
    rawTotal = rawTotal.replace(/O/gi, '0').replace(/[Il]/g, '1');

    cardNumber = rawNum;
    setTotal = rawTotal;

    if (!detectedSetId && SET_TOTAL_MAP[setTotal]) {
      detectedSetId = SET_TOTAL_MAP[setTotal];
    }
  } else {
    // 3. Check for promo patterns: e.g. "SVP EN 025", "SVP 034", "SWSH 123"
    const promoMatch = clean.match(/(?:SVP|SWSH|PR-SV|PR-SW)\s*(?:EN\s*)?([0-9OIl]{1,3})/i);
    if (promoMatch) {
      cardNumber = promoMatch[1].replace(/O/gi, '0').replace(/[Il]/g, '1');
      if (!detectedSetId) {
        detectedSetId = /swsh/i.test(clean) ? 'swshp' : 'svp';
      }
    } else {
      // 4. Standalone card number pattern: e.g. "#151" or standalone "025"
      const numMatch = clean.match(/#\s*(\d{1,4})\b/) || clean.match(/\b(\d{1,3})\b/);
      if (numMatch) {
        cardNumber = numMatch[1];
      }
    }
  }

  // 5. Fall back to the currently selected set if no set code was detected in the text
  if (!detectedSetId && currentSetId && currentSetId !== 'all_owned' && currentSetId !== 'wanted_list' && currentSetId !== 'global_search') {
    detectedSetId = canonicalSetId(currentSetId) || currentSetId;
  }

  return {
    raw: clean,
    cardNumber,
    setTotal,
    detectedSetId
  };
}

export function preprocessCardCanvas(sourceElement, targetBox) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const sx = targetBox.x;
  const sy = targetBox.y;
  const sw = targetBox.width;
  const sh = targetBox.height;

  // Scale up 2x for optimal OCR text resolution
  const scale = 2;
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceElement, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // High-contrast grayscale enhancement for crisp digit reading
  const factor = 1.6;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export async function recognizeCardText(imageSource) {
  const worker = await getOCRWorker();
  const result = await worker.recognize(imageSource);
  return result.data?.text || '';
}

export async function fetchCardMatch(setId, cardNumber) {
  if (!setId || !cardNumber) return null;

  const canonicalId = canonicalSetId(setId) || setId;
  const cleanNum = String(cardNumber).replace(/^[0]+/, '') || String(cardNumber);
  const paddedNum = String(cardNumber).padStart(3, '0');

  const numCandidates = Array.from(new Set([String(cardNumber).trim(), cleanNum, paddedNum]));
  const setCandidates = Array.from(new Set([
    canonicalId,
    setId.toLowerCase().trim(),
    SET_CODE_MAP[setId.toUpperCase().trim()] || null
  ].filter(Boolean)));

  // Try API endpoints for each set and number candidate
  for (const sId of setCandidates) {
    for (const num of numCandidates) {
      try {
        const endpoints = [
          `${TCGDEX_API_BASE}/sets/${encodeURIComponent(sId)}/${encodeURIComponent(num)}`,
          `${TCGDEX_API_BASE}/cards/${encodeURIComponent(sId)}-${encodeURIComponent(num)}`
        ];

        for (const url of endpoints) {
          const res = await fetch(url);
          if (res.ok) {
            const raw = await res.json();
            if (raw && (raw.id || raw.localId)) {
              const cmAvg = raw.pricing?.cardmarket?.avg ?? raw.pricing?.cardmarket?.trend ?? 0.0;
              const tcgMarket = raw.pricing?.tcgplayer?.holofoil?.marketPrice ?? raw.pricing?.tcgplayer?.normal?.marketPrice ?? 0.0;
              const mPrice = cmAvg || tcgMarket || 0.0;
              const img = formatCardImageUrl(raw.image);

              return {
                id: raw.id || `${sId}-${raw.localId || cardNumber}`,
                name: raw.name,
                number: String(raw.localId || raw.number || cardNumber),
                rarity: raw.rarity || 'Common',
                supertype: raw.category || raw.supertype || 'Pokémon',
                image: img,
                image_url: img,
                images: {
                  small: raw.image ? `${raw.image}/low.webp` : img,
                  large: img
                },
                market_price: mPrice,
                cardmarket: {
                  prices: {
                    averageSellPrice: cmAvg,
                    lowPrice: raw.pricing?.cardmarket?.low ?? 0.0,
                    trendPrice: raw.pricing?.cardmarket?.trend ?? 0.0
                  }
                },
                tcgplayer: {
                  prices: {
                    holofoil: { market: raw.pricing?.tcgplayer?.holofoil?.marketPrice ?? 0.0 },
                    normal: { market: raw.pricing?.tcgplayer?.normal?.marketPrice ?? 0.0 }
                  }
                },
                set: {
                  id: raw.set?.id || sId,
                  name: raw.set?.name || sId
                }
              };
            }
          }
        }
      } catch {
        // continue trying next candidate
      }
    }
  }

  // Offline / Seed Fallback: Check local seed cards if available
  try {
    for (const sId of setCandidates) {
      const seedUrl = `./data/seed_cards_${sId}.json`;
      const res = await fetch(seedUrl);
      if (res.ok) {
        const seedData = await res.json();
        const cards = Array.isArray(seedData) ? seedData : (seedData.cards || seedData.data || []);
        const matched = cards.find(c => {
          const cNum = String(c.number || c.localId || '').toLowerCase().trim();
          return numCandidates.some(cand => cand.toLowerCase() === cNum);
        });
        if (matched) {
          const img = formatCardImageUrl(matched.image_url || matched.image);
          return {
            id: matched.id || `${sId}-${matched.number || cardNumber}`,
            name: matched.name,
            number: String(matched.number || matched.localId || cardNumber),
            rarity: matched.rarity || 'Common',
            supertype: matched.supertype || 'Pokémon',
            image: img,
            image_url: img,
            images: {
              small: matched.images?.small || img,
              large: matched.images?.large || img
            },
            market_price: matched.market_price || 0.0,
            cardmarket: matched.cardmarket || null,
            tcgplayer: matched.tcgplayer || null,
            set: {
              id: sId,
              name: matched.set?.name || sId
            }
          };
        }
      }
    }
  } catch {}

  return null;
}
