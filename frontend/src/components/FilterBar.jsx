import React from 'react';
import { Search, ArrowUpDown, X, Layers, Globe, Sparkles, Euro, RotateCcw } from 'lucide-react';

export default function FilterBar({
  searchQuery,
  onSearchChange,
  searchScope = 'set',
  onSearchScopeChange,
  currentSetName = 'This Set',
  statusFilter,
  onStatusFilterChange,
  rarityFilter,
  onRarityFilterChange,
  categoryFilter = 'all',
  onCategoryFilterChange,
  priceFilter = 'all',
  onPriceFilterChange,
  sortBy,
  onSortByChange,
  onResetFilters,
  hasActiveFilters = false,
  rarities = [],
  totalCount,
  ownedCount,
  missingCount,
  wantedCount = 0,
  duplicatesCount = 0,
  isWantedMode = false,
  searchInputRef
}) {
  return (
    <div className="toolbar">
      <div className="search-section">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              searchScope === 'all'
                ? 'Search all Pokémon sets (e.g. Eevee, 151)...'
                : `Search in ${currentSetName}...`
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="search-scope-tabs">
          <button
            type="button"
            className={`scope-pill-btn ${searchScope === 'set' ? 'active' : ''}`}
            onClick={() => onSearchScopeChange && onSearchScopeChange('set')}
          >
            <Layers size={13} />
            <span className="scope-pill-text">In {currentSetName}</span>
          </button>
          <button
            type="button"
            className={`scope-pill-btn all-sets-pill ${searchScope === 'all' ? 'active' : ''}`}
            onClick={() => onSearchScopeChange && onSearchScopeChange('all')}
          >
            <Globe size={13} />
            <span className="scope-pill-text">All Sets</span>
          </button>
        </div>
      </div>

      <div className="filter-controls-strip">
        <div className="filter-btn-group">
          {isWantedMode ? (
            <>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('all')}
                style={statusFilter === 'all' ? { background: 'linear-gradient(135deg, #ff007f, #ff4081)', color: '#ffffff' } : {}}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'unowned' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('unowned')}
                style={statusFilter === 'unowned' ? { background: '#ff007f', color: '#ffffff' } : {}}
              >
                Needed ({missingCount})
              </button>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'owned' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('owned')}
                style={statusFilter === 'owned' ? { background: '#00e676', color: '#090c15' } : {}}
              >
                Owned ({ownedCount})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('all')}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'owned' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('owned')}
                style={statusFilter === 'owned' ? { background: '#00e676', color: '#090c15' } : {}}
              >
                Owned ({ownedCount})
              </button>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'missing' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('missing')}
              >
                Missing ({missingCount})
              </button>
              <button
                type="button"
                className={`filter-btn ${statusFilter === 'wanted' ? 'active' : ''}`}
                onClick={() => onStatusFilterChange('wanted')}
                style={statusFilter === 'wanted' ? { background: '#ff007f', color: '#ffffff' } : {}}
              >
                Wanted ({wantedCount})
              </button>
              {duplicatesCount > 0 && (
                <button
                  type="button"
                  className={`filter-btn ${statusFilter === 'duplicates' ? 'active' : ''}`}
                  onClick={() => onStatusFilterChange('duplicates')}
                  style={
                    statusFilter === 'duplicates'
                      ? { background: 'linear-gradient(135deg, #ffb300, #ff8f00)', color: '#090c15', fontWeight: 800 }
                      : { color: '#ffb300' }
                  }
                  title="Filter cards where you own 2 or more copies"
                >
                  Duplicates ({duplicatesCount})
                </button>
              )}
            </>
          )}
        </div>

        <div className="filter-dropdowns-group">
          <div className={`filter-select-wrap ${rarityFilter !== 'all' ? 'active' : ''}`}>
            <Sparkles size={14} color={rarityFilter !== 'all' ? 'var(--color-primary)' : 'var(--text-muted)'} />
            <select
              className="set-dropdown compact-select"
              value={rarityFilter}
              onChange={(e) => onRarityFilterChange(e.target.value)}
              title="Filter by card rarity"
            >
              <option value="all">All Rarities</option>
              <optgroup label="Rarity Groups">
                <option value="hits">Hits & Secret Rares</option>
                <option value="special_art">Illustration Rares (IR/SIR)</option>
                <option value="ex_ultra">ex & Ultra Rares</option>
                <option value="holos">Holo Rares</option>
              </optgroup>
              {rarities && rarities.length > 0 && (
                <optgroup label="Specific Rarities">
                  {rarities.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className={`filter-select-wrap ${categoryFilter !== 'all' ? 'active' : ''}`}>
            <Layers size={14} color={categoryFilter !== 'all' ? 'var(--color-primary)' : 'var(--text-muted)'} />
            <select
              className="set-dropdown compact-select"
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              title="Filter by card category"
            >
              <option value="all">All Categories</option>
              <option value="pokemon">Pokémon Only</option>
              <option value="trainer">Trainers Only</option>
              <option value="energy">Energy Cards</option>
            </select>
          </div>

          <div className={`filter-select-wrap ${priceFilter !== 'all' ? 'active' : ''}`}>
            <Euro size={14} color={priceFilter !== 'all' ? '#00e676' : 'var(--text-muted)'} />
            <select
              className="set-dropdown compact-select"
              value={priceFilter}
              onChange={(e) => onPriceFilterChange(e.target.value)}
              title="Filter by estimated market price"
            >
              <option value="all">All Prices</option>
              <option value="min_1">Over €1.00</option>
              <option value="min_5">Over €5.00</option>
              <option value="min_10">Over €10.00</option>
              <option value="min_25">Over €25.00</option>
              <option value="has_price">Priced Cards Only</option>
              <option value="no_price">Unpriced Only</option>
            </select>
          </div>

          <div className={`filter-select-wrap ${sortBy !== 'number_asc' && sortBy !== 'number' ? 'active' : ''}`}>
            <ArrowUpDown size={14} color={sortBy !== 'number_asc' && sortBy !== 'number' ? 'var(--color-primary)' : 'var(--text-muted)'} />
            <select
              className="set-dropdown compact-select"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              title="Sort cards"
            >
              <option value="number_asc">Card # (1 → 999)</option>
              <option value="number_desc">Card # (999 → 1)</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="qty_desc">Most Owned (x2+)</option>
              <option value="rarity">Rarity</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="filter-reset-btn"
              onClick={onResetFilters}
              title="Reset all search and filter options"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
