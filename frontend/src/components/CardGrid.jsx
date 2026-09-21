import React from 'react';
import PokemonCard from './PokemonCard';
import { SearchX, Globe } from 'lucide-react';
import { findUserCardEntry } from '../api';

export default function CardGrid({
  cards,
  userCollectionMap,
  isLoading,
  loadingMessage = 'Loading Pokémon Cards...',
  onToggleCard,
  onToggleWanted,
  onQuantityChange,
  onInspectCard,
  searchQuery = '',
  onClearSearch,
  searchScope = 'set',
  currentSetName = 'This Set',
  onSearchAllSets
}) {
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p style={{ fontWeight: 600 }}>{loadingMessage}</p>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="empty-state">
        <SearchX size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>No Cards Found</h3>
        {searchQuery?.trim() ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {searchScope === 'set' ? (
              <>
                <p>No cards matching "{searchQuery}" found in {currentSetName}.</p>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                  {onSearchAllSets && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={onSearchAllSets}
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#ffffff' }}
                    >
                      <Globe size={15} />
                      <span>Search All Sets for "{searchQuery}"</span>
                    </button>
                  )}
                  {onClearSearch && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClearSearch}
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p>No cards matching "{searchQuery}" found across all Pokémon sets.</p>
                {onClearSearch && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClearSearch}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Clear Search
                  </button>
                )}
              </>
            )}
          </div>
        ) : searchScope === 'all' ? (
          <p>Type a Pokémon name, card number, or set above to search across all sets.</p>
        ) : (
          <p>Try adjusting your filter options.</p>
        )}
      </div>
    );
  }

  return (
    <div className="card-grid">
      {cards.map((card) => {
        const userEntry = findUserCardEntry(userCollectionMap, card);
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
