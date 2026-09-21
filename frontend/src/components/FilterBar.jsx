import React from 'react';
import { Search, Filter, ArrowUpDown, X, Layers, Globe } from 'lucide-react';

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
  sortBy,
  onSortByChange,
  rarities,
  totalCount,
  ownedCount,
  missingCount,
  wantedCount = 0,
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
            </>
          )}
        </div>

        <div className="filter-dropdowns-group">
          <div className="filter-select-wrap">
            <Filter size={15} color="var(--text-muted)" />
            <select
              className="set-dropdown compact-select"
              value={rarityFilter}
              onChange={(e) => onRarityFilterChange(e.target.value)}
            >
              <option value="all">All Rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrap">
            <ArrowUpDown size={15} color="var(--text-muted)" />
            <select
              className="set-dropdown compact-select"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
            >
              <option value="number">Card #</option>
              <option value="name">Name</option>
              <option value="rarity">Rarity</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
