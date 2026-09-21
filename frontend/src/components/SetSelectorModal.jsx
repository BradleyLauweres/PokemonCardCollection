import React, { useState, useMemo } from 'react';
import { X, Search, Layers, BookOpen, Heart, Check, Flame } from 'lucide-react';

function SetRowLogo({ logo, symbol, name }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = logo || symbol;
  if (!src || imgFailed) {
    return <Flame size={24} color="var(--color-primary)" />;
  }
  return (
    <img
      src={src}
      alt={name}
      className={logo ? 'set-row-img' : 'set-row-symbol'}
      onError={() => setImgFailed(true)}
    />
  );
}

export default function SetSelectorModal({
  sets,
  selectedSetId,
  onSelectSet,
  onClose,
  totalOwnedCount = 0,
  totalWantedCount = 0
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('all');

  const seriesList = useMemo(() => {
    const s = new Set();
    sets.forEach((set) => {
      if (set.series) s.add(set.series);
    });
    return Array.from(s);
  }, [sets]);

  const filteredSets = useMemo(() => {
    return sets.filter((set) => {
      if (selectedSeries !== 'all' && set.series !== selectedSeries) {
        return false;
      }
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase().trim();
        const nameMatch = set.name?.toLowerCase().includes(q);
        const seriesMatch = set.series?.toLowerCase().includes(q);
        const idMatch = set.id?.toLowerCase().includes(q);
        if (!nameMatch && !seriesMatch && !idMatch) return false;
      }
      return true;
    });
  }, [sets, selectedSeries, filterQuery]);

  const handlePick = (id) => {
    onSelectSet(id);
    onClose();
  };

  return (
    <div className="modal-overlay set-selector-overlay" onClick={onClose}>
      <div className="modal-content set-selector-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drag-handle" />

        <div className="set-selector-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="brand-icon" style={{ width: 34, height: 34 }}>
              <Layers size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                Select Pokémon Set
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {filteredSets.length} sets available
              </span>
            </div>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose} title="Close set picker">
            <X size={18} />
          </button>
        </div>

        <div className="set-selector-quick-actions">
          <button
            type="button"
            className={`quick-view-card ${selectedSetId === 'all_owned' ? 'active-binder' : ''}`}
            onClick={() => handlePick('all_owned')}
          >
            <div className="quick-view-icon binder-icon">
              <BookOpen size={18} />
            </div>
            <div className="quick-view-text">
              <strong>My Binder</strong>
              <span>{totalOwnedCount} collected cards</span>
            </div>
            {selectedSetId === 'all_owned' && <Check size={16} className="quick-view-check" />}
          </button>

          <button
            type="button"
            className={`quick-view-card ${selectedSetId === 'wanted_list' ? 'active-wanted' : ''}`}
            onClick={() => handlePick('wanted_list')}
          >
            <div className="quick-view-icon wanted-icon">
              <Heart size={18} fill={selectedSetId === 'wanted_list' ? '#fff' : 'none'} />
            </div>
            <div className="quick-view-text">
              <strong>Wishlist</strong>
              <span>{totalWantedCount} wanted cards</span>
            </div>
            {selectedSetId === 'wanted_list' && <Check size={16} className="quick-view-check" />}
          </button>
        </div>

        <div className="set-selector-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search sets by name (e.g., 151, Crown Zenith)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setFilterQuery('')}
              title="Clear set search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="series-filter-strip">
          <button
            type="button"
            className={`series-chip ${selectedSeries === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedSeries('all')}
          >
            All Series ({sets.length})
          </button>
          {seriesList.map((series) => (
            <button
              key={series}
              type="button"
              className={`series-chip ${selectedSeries === series ? 'active' : ''}`}
              onClick={() => setSelectedSeries(series)}
            >
              {series}
            </button>
          ))}
        </div>

        <div className="set-list-scroll">
          {filteredSets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <p>No sets matching your search.</p>
            </div>
          ) : (
            filteredSets.map((set) => {
              const isSelected = selectedSetId === set.id;
              const setLogo = set.images?.logo || set.logo;
              const setSymbol = set.images?.symbol || set.symbol;

              return (
                <div
                  key={set.id}
                  className={`set-list-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => handlePick(set.id)}
                >
                  <div className="set-row-logo">
                    <SetRowLogo logo={setLogo} symbol={setSymbol} name={set.name} />
                  </div>

                  <div className="set-row-info">
                    <div className="set-row-name-line">
                      <span className="set-row-title">{set.name}</span>
                      {isSelected && (
                        <span className="set-active-badge">
                          <Check size={12} strokeWidth={3} /> Current
                        </span>
                      )}
                    </div>
                    <div className="set-row-meta">
                      <span className="badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                        {set.series}
                      </span>
                      <span>{set.total || 0} cards</span>
                      {set.releaseDate && <span>• {set.releaseDate}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
