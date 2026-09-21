import React, { useState, useEffect } from 'react';
import { Layers, Sparkles, PieChart, Euro, BookOpen, Heart, Cloud, RefreshCw, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { subscribeSyncState, getSyncState } from '../api';

export default function Navbar({
  sets,
  selectedSetId,
  activeSetName = '',
  onSelectSet,
  onOpenSetSelector,
  onOpenStats,
  onOpenGitHubSettings,
  totalOwnedCount,
  totalWantedCount,
  totalMarketValue,
  searchQuery = ''
}) {
  const [syncState, setSyncState] = useState(getSyncState());

  useEffect(() => {
    const unsub = subscribeSyncState((st) => setSyncState(st));
    return () => unsub();
  }, []);

  const seriesMap = sets.reduce((acc, set) => {
    const series = set.series || 'Other';
    if (!acc[series]) acc[series] = [];
    acc[series].push(set);
    return acc;
  }, {});

  const currentDisplayName = activeSetName || (
    selectedSetId === 'all_owned'
      ? 'My Binder'
      : selectedSetId === 'wanted_list'
      ? 'Wishlist'
      : selectedSetId === 'global_search'
      ? 'Search All Sets'
      : (sets.find(s => s.id === selectedSetId)?.name || 'Select Set')
  );

  return (
    <header className="navbar">
      <div className="brand" onClick={() => onOpenStats && onOpenStats()}>
        <div className="brand-icon">
          <Sparkles size={20} color="#ffffff" />
        </div>
        <div>
          <h1 className="brand-title">PokéTrack</h1>
        </div>
      </div>

      <div className="mobile-nav-center">
        <button
          type="button"
          className="mobile-set-pill"
          onClick={onOpenSetSelector}
          title="Switch Pokémon Set or View"
        >
          <Layers size={14} color="var(--color-primary)" />
          <span className="mobile-set-pill-text">{currentDisplayName}</span>
          <ChevronDown size={13} color="var(--text-muted)" />
        </button>
      </div>

      <div className="desktop-nav-controls">
        <button
          className={`btn ${selectedSetId === 'all_owned' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onSelectSet('all_owned')}
          title="View all cards in your collection across all sets"
        >
          <BookOpen size={16} color={selectedSetId === 'all_owned' ? '#090c15' : 'var(--color-primary)'} />
          <span>My Binder</span>
        </button>

        <button
          className={`btn ${selectedSetId === 'wanted_list' ? 'btn-primary' : 'btn-secondary'}`}
          style={selectedSetId === 'wanted_list' ? { background: 'linear-gradient(135deg, #ff007f, #ff4081)', color: '#fff' } : {}}
          onClick={() => onSelectSet('wanted_list')}
          title="View cards on your Wanted Wishlist"
        >
          <Heart size={16} fill={selectedSetId === 'wanted_list' ? '#ffffff' : '#ff007f'} color="#ff007f" />
          <span>Wanted ({totalWantedCount || 0})</span>
        </button>

        <div className="set-selector-group">
          <Layers size={18} color="var(--color-primary)" />
          <select
            className="set-dropdown"
            value={selectedSetId}
            onChange={(e) => onSelectSet(e.target.value)}
          >
            <option value="all_owned">MY BINDER (All Owned Cards)</option>
            <option value="wanted_list">MY WANTED LIST (Wishlist)</option>
            {selectedSetId === 'global_search' && (
              <option value="global_search">
                GLOBAL SEARCH: {searchQuery ? `"${searchQuery}"` : 'All Sets'}
              </option>
            )}
            {Object.entries(seriesMap).map(([series, setGroup]) => (
              <optgroup key={series} label={`─── ${series.toUpperCase()} ───`}>
                {setGroup.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name} ({set.total} cards)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="nav-right-controls">
        <button
          className="btn btn-secondary mobile-sync-btn"
          onClick={onOpenGitHubSettings}
          title={
            syncState.status === 'synced'
              ? 'Synced with GitHub repository. Click to manage settings.'
              : syncState.status === 'syncing'
              ? 'Saving changes to GitHub...'
              : syncState.status === 'error'
              ? `Sync Error: ${syncState.lastError || ''}. Click to check settings.`
              : 'Configure GitHub Cloud Sync'
          }
          style={{
            borderColor:
              syncState.status === 'synced'
                ? 'rgba(0, 230, 118, 0.4)'
                : syncState.status === 'error'
                ? 'rgba(255, 82, 82, 0.4)'
                : undefined,
            background:
              syncState.status === 'synced'
                ? 'rgba(0, 230, 118, 0.08)'
                : syncState.status === 'error'
                ? 'rgba(255, 82, 82, 0.08)'
                : undefined
          }}
        >
          {syncState.status === 'synced' && <CheckCircle2 size={16} color="var(--color-success)" />}
          {syncState.status === 'syncing' && <RefreshCw size={16} className="spin-animation" color="var(--color-primary)" />}
          {syncState.status === 'error' && <AlertCircle size={16} color="var(--color-danger)" />}
          {syncState.status === 'pending' && <RefreshCw size={16} color="var(--color-accent)" />}
          {syncState.status === 'unconfigured' && <Cloud size={16} color="var(--text-muted)" />}
          <span className="sync-btn-text">
            {syncState.status === 'synced'
              ? 'Synced'
              : syncState.status === 'syncing'
              ? 'Syncing'
              : syncState.status === 'error'
              ? 'Error'
              : syncState.status === 'pending'
              ? 'Pending'
              : 'Cloud'}
          </span>
        </button>

        <div className="stats-badge desktop-only" onClick={onOpenStats} style={{ cursor: 'pointer' }}>
          <div className="stat-item" title="Total Collected Cards">
            <span className="stat-label">Collected</span>
            <span className="stat-value">{totalOwnedCount}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item" title="Total Wishlist Cards">
            <span className="stat-label">Wanted</span>
            <span className="stat-value" style={{ color: '#ff4081' }}>{totalWantedCount}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item" title="Total Estimated Market Value">
            <Euro size={12} color="#00e676" />
            <span className="stat-value value-highlight">€{totalMarketValue.toFixed(2)}</span>
          </div>
          <div className="stat-divider"></div>
          <button
            type="button"
            className="icon-btn"
            style={{ padding: '0.2rem', color: 'var(--color-primary)' }}
            title="View Portfolio Analytics & Breakdown"
          >
            <PieChart size={15} />
          </button>
        </div>

        <div className="mobile-value-pill" onClick={onOpenStats} title="View Portfolio Stats">
          <Euro size={12} color="#00e676" />
          <span>{totalMarketValue.toFixed(0)}</span>
        </div>
      </div>
    </header>
  );
}
