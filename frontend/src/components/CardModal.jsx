import React, { useState, useEffect } from 'react';
import { X, Check, Euro, Save, Heart, RefreshCw } from 'lucide-react';
import { fetchCardDetails } from '../api';
import placeholderImg from '../assets/placeholder.png';

export default function CardModal({
  card,
  isOwned,
  isWanted,
  userCardEntry,
  onToggle,
  onToggleWanted,
  onSavePrice,
  onClose
}) {
  const [enrichedData, setEnrichedData] = useState(null);
  const [prevCardId, setPrevCardId] = useState(card?.id);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState(userCardEntry?.custom_price ?? '');
  const [notesInput, setNotesInput] = useState(userCardEntry?.notes ?? '');
  const [isSavedMsg, setIsSavedMsg] = useState(false);

  if (card?.id !== prevCardId) {
    setPrevCardId(card?.id);
    setEnrichedData(null);
    setCustomPriceInput(userCardEntry?.custom_price ?? '');
    setNotesInput(userCardEntry?.notes ?? '');
  }

  useEffect(() => {
    if (!card) return;

    const hasDetailedPrice = (card.cardmarket?.prices?.averageSellPrice || 0) > 0;
    const hasAttacks = Array.isArray(card.attacks) && card.attacks.length > 0;

    if (!hasDetailedPrice && !hasAttacks) {
      let isCancelled = false;
      fetchCardDetails(card.id)
        .then((fullData) => {
          if (!isCancelled && fullData) {
            setEnrichedData(fullData);
          }
        })
        .finally(() => {
          if (!isCancelled) setIsLoadingDetails(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [card]);

  if (!card) return null;

  const currentCard = enrichedData ? { ...card, ...enrichedData } : card;
  const largeImg = currentCard.images?.large || currentCard.images?.small || currentCard.image_url || placeholderImg;

  const cmPrice = currentCard.cardmarket?.prices?.averageSellPrice;
  const tcgPrice = currentCard.tcgplayer?.prices?.holofoil?.market || currentCard.tcgplayer?.prices?.normal?.market || currentCard.tcgplayer?.prices?.reverseHolofoil?.market;
  const apiPrice = cmPrice || tcgPrice || currentCard.market_price || 0.0;

  const handleSaveCustomPrice = (e) => {
    e.preventDefault();
    onSavePrice(card.id, parseFloat(customPriceInput) || 0.0, notesInput);
    setIsSavedMsg(true);
    setTimeout(() => setIsSavedMsg(false), 2500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drag-handle" />
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close card details">
          <X size={20} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
            <img
              src={largeImg || placeholderImg}
              alt={currentCard.name}
              style={{
                width: '100%',
                display: 'block',
                borderRadius: 12,
                filter: isOwned ? 'none' : 'grayscale(100%) opacity(0.6)'
              }}
              onError={(e) => {
                if (e.currentTarget.src !== placeholderImg) {
                  e.currentTarget.src = placeholderImg;
                }
              }}
            />
          </div>

          <button
            className={`btn ${isOwned ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onToggle(currentCard, apiPrice)}
          >
            {isOwned ? (
              <>
                <X size={18} /> Remove from Collection
              </>
            ) : (
              <>
                <Check size={18} /> Mark as Owned (Full Color)
              </>
            )}
          </button>

          <button
            className="btn btn-secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
              background: isWanted ? 'rgba(255, 0, 127, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              borderColor: isWanted ? '#ff007f' : 'rgba(255, 255, 255, 0.12)',
              color: isWanted ? '#ff4081' : '#fff'
            }}
            onClick={() => onToggleWanted(currentCard)}
          >
            <Heart size={18} fill={isWanted ? '#ff007f' : 'none'} color="#ff007f" />
            {isWanted ? 'On Wanted List' : 'Add to Wanted List'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <span className="card-number" style={{ fontSize: '0.9rem' }}>#{currentCard.number}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: '0.2rem 0' }}>{currentCard.name}</h2>
              {isLoadingDetails && <RefreshCw size={16} className="spin-animation" color="var(--color-primary)" />}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <span className="badge">{currentCard.supertype || 'Pokémon'}</span>
              {currentCard.subtypes?.map((st) => (
                <span key={st} className="badge" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  {st}
                </span>
              ))}
              {currentCard.hp && <span className="badge" style={{ background: '#ff007f', color: '#fff' }}>{currentCard.hp} HP</span>}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cardmarket EUR Market Price</span>
              <span style={{ fontWeight: 700, color: '#00e676' }}>
                {apiPrice > 0 ? `€${apiPrice.toFixed(2)}` : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rarity</span>
              <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{currentCard.rarity || userCardEntry?.rarity || 'Common'}</span>
            </div>

            {currentCard.artist && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Illustrator</span>
                <span style={{ fontWeight: 600 }}>{currentCard.artist}</span>
              </div>
            )}
          </div>

          {Array.isArray(currentCard.attacks) && currentCard.attacks.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
                ATTACKS & ABILITIES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentCard.attacks.map((att, idx) => (
                  <div key={idx} style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#fff' }}>
                      <span>{att.name}</span>
                      {att.damage && <span style={{ color: 'var(--color-accent)' }}>{att.damage}</span>}
                    </div>
                    {att.effect && <p style={{ color: 'var(--text-muted)', margin: 0 }}>{att.effect}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOwned && (
            <form onSubmit={handleSaveCustomPrice} style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)', padding: '1rem', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Euro size={16} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>Custom Purchase Price (€) & Notes</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginLeft: 'auto' }}>Saved to Collection</span>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Price Paid (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15.50"
                    value={customPriceInput}
                    onChange={(e) => setCustomPriceInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#090c15',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 8,
                      color: '#fff',
                      fontFamily: 'inherit',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Notes / Condition</label>
                  <input
                    type="text"
                    placeholder="e.g. Near Mint, Holo shift"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#090c15',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 8,
                      color: '#fff',
                      fontFamily: 'inherit',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <button className="btn btn-primary" type="submit" style={{ justifyContent: 'center' }}>
                <Save size={16} /> Save Price & Notes
              </button>

              {isSavedMsg && (
                <span style={{ fontSize: '0.8rem', color: '#00e676', textAlign: 'center', fontWeight: 600 }}>
                  Saved to collection permanently!
                </span>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
