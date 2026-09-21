import React, { useRef } from 'react';
import { Check, Lock, Eye, Plus, Minus, Tag, Heart } from 'lucide-react';
import placeholderImg from '../assets/placeholder.png';

export default function PokemonCard({
  card,
  isOwned,
  isWanted,
  userEntry,
  quantity = 0,
  onToggle,
  onToggleWanted,
  onQuantityChange,
  onInspectCard
}) {
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isTouchScrolling = useRef(false);

  const imageUrl = card.images?.small || card.images?.large || card.image_url || placeholderImg;

  const cmPrice = card.cardmarket?.prices?.averageSellPrice;
  const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || card.tcgplayer?.prices?.reverseHolofoil?.market;
  const apiPrice = cmPrice || tcgPrice || card.market_price || 0;

  const displayPrice = userEntry?.custom_price > 0
    ? userEntry.custom_price
    : (userEntry?.market_price > 0 ? userEntry.market_price : apiPrice);

  const hasCustomPrice = userEntry?.custom_price > 0;

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isTouchScrolling.current = false;
  };

  const handleTouchMove = (e) => {
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (dy > 8 || dx > 8) {
      isTouchScrolling.current = true;
    }
  };

  const handleWrapperClick = (e) => {
    if (isTouchScrolling.current) return;
    if (e.target.closest('.no-toggle')) return;
    onToggle(card, apiPrice);
  };

  let wrapperClass = 'pokemon-card-wrapper';
  if (isOwned && isWanted) {
    wrapperClass += ' owned wanted-owned-glow';
  } else if (isOwned) {
    wrapperClass += ' owned';
  } else if (isWanted) {
    wrapperClass += ' unowned wanted-unowned';
  } else {
    wrapperClass += ' unowned';
  }

  return (
    <div
      className={wrapperClass}
      onClick={handleWrapperClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      title={
        isOwned && isWanted
          ? `${card.name} (#${card.number}) - OWNED & WANTED (GLOWING)`
          : isOwned
          ? `${card.name} (#${card.number}) - OWNED`
          : isWanted
          ? `${card.name} (#${card.number}) - WANTED (Grayscale until owned)`
          : `Click to mark ${card.name} (#${card.number}) as OWNED`
      }
    >
      {isOwned && (
        <div className="owned-badge" title="Card Collected!">
          <Check size={18} strokeWidth={3} />
        </div>
      )}

      {!isOwned && !isWanted && (
        <div className="unowned-overlay" title="Click card to mark as owned">
          <Lock size={20} />
        </div>
      )}

      <button
        type="button"
        className="no-toggle card-action-btn card-heart-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleWanted(card);
        }}
        style={{
          top: isOwned ? '42px' : '8px',
          background: isWanted ? 'linear-gradient(135deg, #ff007f, #ff4081)' : 'rgba(9, 12, 21, 0.75)',
          borderColor: isWanted ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)',
          boxShadow: isWanted ? '0 0 12px rgba(255, 0, 127, 0.7)' : 'none',
          color: isWanted ? '#fff' : 'var(--text-muted)'
        }}
        title={isWanted ? 'Remove from Wanted List' : 'Add to Wanted List'}
      >
        <Heart size={15} fill={isWanted ? '#ffffff' : 'none'} stroke={isWanted ? '#ffffff' : 'currentColor'} />
      </button>

      <div
        className="no-toggle card-price-pill"
        style={{
          background: hasCustomPrice
            ? 'linear-gradient(135deg, #ffcc00, #ff9900)'
            : (isOwned ? 'rgba(0, 230, 118, 0.9)' : (isWanted ? 'rgba(255, 0, 127, 0.85)' : 'rgba(9, 12, 21, 0.85)')),
          color: hasCustomPrice ? '#090c15' : (isOwned || isWanted ? '#ffffff' : 'var(--color-primary)')
        }}
        title={hasCustomPrice ? `Custom Price: €${displayPrice.toFixed(2)}` : `Est. Market Price: €${displayPrice.toFixed(2)}`}
      >
        {hasCustomPrice && <Tag size={10} />}
        {displayPrice > 0 ? `€${displayPrice.toFixed(2)}` : 'N/A'}
      </div>

      <button
        type="button"
        className="no-toggle card-action-btn card-inspect-btn"
        onClick={(e) => {
          e.stopPropagation();
          onInspectCard(card);
        }}
        title="Inspect card details & edit price"
      >
        <Eye size={14} />
      </button>

      <div className="card-img-container">
        <img
          src={imageUrl || placeholderImg}
          alt={card.name}
          className="card-img"
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget.src !== placeholderImg) {
              e.currentTarget.src = placeholderImg;
            }
          }}
        />
      </div>

      <div className="card-footer">
        <div className="card-name-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
            <span className="card-number">#{card.number}</span>
            {card.set?.name && (
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--color-accent)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100px'
                }}
                title={card.set.name}
              >
                • {card.set.name}
              </span>
            )}
          </div>
          <span className="card-name">{card.name}</span>
          <span className="card-rarity">{card.rarity || userEntry?.rarity || card.supertype}</span>
        </div>

        {isOwned && (
          <div className="quantity-controls no-toggle" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="qty-btn"
              onClick={() => onQuantityChange(card.id, quantity - 1)}
              title="Decrease quantity"
            >
              <Minus size={12} />
            </button>
            <span className="qty-val">x{quantity}</span>
            <button
              type="button"
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
