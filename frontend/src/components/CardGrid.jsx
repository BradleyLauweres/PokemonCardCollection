import React from 'react';
import PokemonCard from './PokemonCard';
import { SearchX } from 'lucide-react';

export default function CardGrid({
  cards,
  userCollectionMap,
  isLoading,
  onToggleCard,
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
        const isOwned = !!userEntry;
        const quantity = userEntry ? userEntry.quantity || 1 : 0;

        return (
          <PokemonCard
            key={card.id}
            card={card}
            isOwned={isOwned}
            userEntry={userEntry}
            quantity={quantity}
            onToggle={onToggleCard}
            onQuantityChange={onQuantityChange}
            onInspectCard={onInspectCard}
          />
        );
      })}
    </div>
  );
}
