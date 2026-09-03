import React from 'react';
import { Check, Lock, Eye, Plus, Minus, Tag } from 'lucide-react';

export default function PokemonCard({
  card,
  isOwned,
  userEntry,
  quantity = 0,
  onToggle,
  onQuantityChange,
  onInspectCard
}) {
  const imageUrl = card.images?.small || card.images?.large || '';

  // Extract prices from API (Cardmarket average sell price is natively in EUR)
  const cmPrice = card.cardmarket?.prices?.averageSellPrice;
  const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || card.tcgplayer?.prices?.reverseHolofoil?.market;
  const apiPrice = cmPrice || tcgPrice || 0;

  const displayPrice = userEntry?.custom_price > 0
    ? userEntry.custom_price
    : (userEntry?.market_price > 0 ? userEntry.market_price : apiPrice);

  const hasCustomPrice = userEntry?.custom_price > 0;

  const handleWrapperClick = (e) => {
    if (e.target.closest('.no-toggle')) return;
    onToggle(card, apiPrice);
  };

  return (
    <div
      className={`pokemon-card-wrapper ${isOwned ? 'owned' : 'unowned'}`}
      onClick={handleWrapperClick}
      title={isOwned ? `${card.name} (#${card.number}) - Click to toggle / remove` : `Click to mark ${card.name} (#${card.number}) as OWNED`}
    >
      {/* Owned Badge */}
      {isOwned && (
        <div className="owned-badge" title="Card Collected!">
          <Check size={18} strokeWidth={3} />
        </div>
      )}

      {/* Unowned Lock Overlay Icon */}
      {!isOwned && (
        <div className="unowned-overlay" title="Click card to mark as owned">
          <Lock size={20} />
        </div>
      )}

      {/* Price Badge on Card */}
      <div
        className="no-toggle"
        style={{
          position: 'absolute',
          bottom: '54px',
          right: '8px',
          background: hasCustomPrice
            ? 'linear-gradient(135deg, #ffcc00, #ff9900)'
            : (isOwned ? 'rgba(0, 230, 118, 0.9)' : 'rgba(9, 12, 21, 0.85)'),
          color: hasCustomPrice ? '#090c15' : (isOwned ? '#090c15' : 'var(--color-primary)'),
          padding: '0.2rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 800,
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          zIndex: 6,
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}
        title={hasCustomPrice ? `Custom Price: €${displayPrice.toFixed(2)}` : `Est. Market Price: €${displayPrice.toFixed(2)}`}
      >
        {hasCustomPrice && <Tag size={10} />}
        {displayPrice > 0 ? `€${displayPrice.toFixed(2)}` : 'N/A'}
      </div>

      {/* Inspect Button Top Left */}
      <button
        className="no-toggle"
        onClick={(e) => {
          e.stopPropagation();
          onInspectCard(card);
        }}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(9, 12, 21, 0.75)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 7,
          backdropFilter: 'blur(4px)'
        }}
        title="Inspect card details & edit price"
      >
        <Eye size={14} />
      </button>

      {/* Card Image */}
      <div className="card-img-container">
        <img
          src={imageUrl}
          alt={card.name}
          className="card-img"
          loading="lazy"
        />
      </div>

      {/* Card Footer Info */}
      <div className="card-footer">
        <div className="card-name-group">
          <span className="card-number">#{card.number}</span>
          <span className="card-name">{card.name}</span>
          <span className="card-rarity">{card.rarity || card.supertype}</span>
        </div>

        {/* Quantity Controls when owned */}
        {isOwned && (
          <div className="quantity-controls no-toggle" onClick={(e) => e.stopPropagation()}>
            <button
              className="qty-btn"
              onClick={() => onQuantityChange(card.id, quantity - 1)}
              title="Decrease quantity"
            >
              <Minus size={12} />
            </button>
            <span className="qty-val">x{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => onQuantityChange(card.id, quantity + 1)}
              title="Increase quantity"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
