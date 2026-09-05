import React, { useState, useEffect } from 'react';
import { Layers, Sparkles, PieChart, Euro, BookOpen, Heart, Cloud, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { subscribeSyncState, getSyncState } from '../api';

export default function Navbar({
  sets,
  selectedSetId,
  onSelectSet,
  onOpenStats,
  onOpenGitHubSettings,
  totalOwnedCount,
  totalWantedCount,
  totalMarketValue
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

  return (
    <header className="navbar">
      <div className="brand" onClick={() => onOpenStats && onOpenStats()}>
        <div className="brand-icon">
          <Sparkles size={20} color="#ffffff" />
        </div>
        <div>
          <h1 className="brand-title">PokéTrack TCG</h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <option value="all_owned">🌟 MY BINDER (All Owned Cards)</option>
            <option value="wanted_list">❤️ MY WANTED LIST (Wishlist)</option>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {/* GitHub Cloud Sync Button */}
        <button
          className="btn btn-secondary"
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
          {(syncState.status === 'syncing' || syncState.status === 'pending') && (
            <RefreshCw size={16} color="var(--color-accent)" className="spin-animation" />
          )}
          {syncState.status === 'error' && <AlertCircle size={16} color="var(--color-danger)" />}
          {syncState.status === 'unconfigured' && <Cloud size={16} color="var(--color-primary)" />}

          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
            {syncState.status === 'synced' && 'GitHub Synced'}
            {syncState.status === 'syncing' && 'Syncing...'}
            {syncState.status === 'pending' && 'Saving...'}
            {syncState.status === 'error' && 'Sync Failed'}
            {syncState.status === 'unconfigured' && 'Cloud Sync'}
          </span>
        </button>

        <button
          className="btn btn-primary"
          onClick={onOpenStats}
          style={{ background: 'linear-gradient(135deg, #00e676, #00b0ff)' }}
          title="Total Collection Portfolio Value in Euro"
        >
          <Euro size={18} color="#090c15" />
          <span style={{ fontWeight: 800, color: '#090c15' }}>
            €{(totalMarketValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total Value
          </span>
        </button>

        <button className="btn btn-secondary" onClick={onOpenStats} title="View Overall Collection Stats">
          <PieChart size={16} color="var(--color-primary)" />
          <span style={{ fontWeight: 700 }}>{totalOwnedCount} Owned</span>
        </button>
      </div>
    </header>
  );
}
