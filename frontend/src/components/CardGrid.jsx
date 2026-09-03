import React from 'react';
import PokemonCard from './PokemonCard';
import { SearchX } from 'lucide-react';

export default function CardGrid({
  cards,
  userCollectionMap,
  isLoading,
  onToggleCard,
  onToggleWanted,
  onQuantityChange,
  onInspectCard
}) {
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p style={{ fontWeight: 600 }}>Loading Pokémon Set Cards...</p>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="empty-state">
        <SearchX size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>No Cards Found</h3>
        <p>Try adjusting your search query or filter options.</p>
      </div>
    );
  }

  return (
    <div className="card-grid">
      {cards.map((card) => {
        const userEntry = userCollectionMap[card.id];
        const isOwned = !!(userEntry && userEntry.quantity > 0);
        const isWanted = !!(userEntry && userEntry.is_wanted);
        const quantity = userEntry ? userEntry.quantity || 0 : 0;

        return (
          <PokemonCard
            key={card.id}
            card={card}
            isOwned={isOwned}
            isWanted={isWanted}
            userEntry={userEntry}
            quantity={quantity}
            onToggle={onToggleCard}
            onToggleWanted={onToggleWanted}
            onQuantityChange={onQuantityChange}
            onInspectCard={onInspectCard}
          />
        );
      })}
    </div>
  );
}
