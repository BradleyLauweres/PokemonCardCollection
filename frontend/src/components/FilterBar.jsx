import React from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

export default function FilterBar({
  searchQuery,
  onSearchChange,
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
  isWantedMode = false
}) {
  return (
    <div className="toolbar">
      <div className="search-box">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search card by name or number (e.g., Pikachu, 025)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-btn-group">
        {isWantedMode ? (
          <>
            <button
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('all')}
              style={statusFilter === 'all' ? { background: 'linear-gradient(135deg, #ff007f, #ff4081)', color: '#ffffff' } : {}}
            >
              ❤️ All Wanted ({totalCount})
            </button>
            <button
              className={`filter-btn ${statusFilter === 'unowned' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('unowned')}
              style={statusFilter === 'unowned' ? { background: '#ff007f', color: '#ffffff' } : {}}
            >
              Still Needed ({missingCount})
            </button>
            <button
              className={`filter-btn ${statusFilter === 'owned' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('owned')}
              style={statusFilter === 'owned' ? { background: '#00e676', color: '#090c15' } : {}}
            >
              Also Owned ({ownedCount})
            </button>
          </>
        ) : (
          <>
            <button
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('all')}
            >
              All ({totalCount})
            </button>
            <button
              className={`filter-btn ${statusFilter === 'owned' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('owned')}
              style={statusFilter === 'owned' ? { background: '#00e676', color: '#090c15' } : {}}
            >
              Owned ({ownedCount})
            </button>
            <button
              className={`filter-btn ${statusFilter === 'missing' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('missing')}
            >
              Missing ({missingCount})
            </button>
            <button
              className={`filter-btn ${statusFilter === 'wanted' ? 'active' : ''}`}
              onClick={() => onStatusFilterChange('wanted')}
              style={statusFilter === 'wanted' ? { background: '#ff007f', color: '#ffffff' } : {}}
            >
              ❤️ Wanted ({wantedCount})
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            className="set-dropdown"
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', borderRadius: 8 }}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowUpDown size={16} color="var(--text-muted)" />
          <select
            className="set-dropdown"
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', borderRadius: 8 }}
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
          >
            <option value="number">Sort by Card #</option>
            <option value="name">Sort by Name</option>
            <option value="rarity">Sort by Rarity</option>
          </select>
        </div>
      </div>
    </div>
  );
}
