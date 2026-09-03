import React from 'react';
import { Calendar, CheckCircle2, Trash2, Trophy, Flame, Euro, BookOpen, Heart, Download, Upload } from 'lucide-react';

export default function SetBanner({
  set,
  cardsCount,
  ownedCount,
  setValue = 0,
  isAllOwnedMode = false,
  isWantedMode = false,
  onMarkAll,
  onClearAll,
  onBackup,
  onRestore
}) {
  if (isWantedMode) {
    return (
      <div className="set-banner" style={{ background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.15) 0%, rgba(18, 24, 40, 0.95) 100%)', borderColor: 'rgba(255, 0, 127, 0.4)' }}>
        <div className="set-header-row">
          <div className="set-info-left">
            <div className="brand-icon" style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #ff007f, #ff4081)' }}>
              <Heart size={28} color="#ffffff" fill="#ffffff" />
            </div>
            <div className="set-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1>My Wanted List (Wishlist)</h1>
              </div>
              <div className="set-meta">
                <span className="badge" style={{ background: '#ff007f', color: '#ffffff', fontWeight: 800 }}>WISHLIST</span>
                <span>• Cards you and your partner are looking to buy or collect</span>
                {setValue > 0 && (
                  <span className="badge" style={{ background: 'rgba(255, 0, 127, 0.2)', borderColor: '#ff007f', color: '#ff4081', fontWeight: 800 }}>
                    <Euro size={12} style={{ verticalAlign: 'middle' }} /> Est. Cost to Complete: €{setValue.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => onBackup && onBackup('wanted_list')}
              title="Download text backup file for your wanted cards"
              style={{ background: 'rgba(255, 0, 127, 0.15)', borderColor: '#ff007f', color: '#ff4081' }}
            >
              <Download size={15} />
              <span>Backup Wishlist (.txt)</span>
            </button>
            <label
              className="btn btn-secondary"
              style={{ cursor: 'pointer', background: 'rgba(255, 255, 255, 0.08)' }}
              title="Restore wishlist from a .txt backup file"
            >
              <Upload size={15} />
              <span>Restore (.txt)</span>
              <input
                type="file"
                accept=".txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onRestore && onRestore(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div className="progress-container">
          <div className="progress-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Heart size={18} color="#ff007f" fill="#ff007f" />
              <span style={{ fontWeight: 700, color: '#fff' }}>Total Wanted Cards</span>
            </div>
            <div>
              <span className="progress-stats-num" style={{ color: '#ff4081' }}>{cardsCount}</span>
              <span style={{ color: 'var(--text-muted)' }}> cards on your wishlist</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAllOwnedMode) {
    return (
      <div className="set-banner" style={{ background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.12) 0%, rgba(18, 24, 40, 0.95) 100%)', borderColor: 'rgba(0, 229, 255, 0.3)' }}>
        <div className="set-header-row">
          <div className="set-info-left">
            <div className="brand-icon" style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #00e676, #00b0ff)' }}>
              <BookOpen size={28} color="#090c15" />
            </div>
            <div className="set-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1>My Pokémon Card Binder</h1>
              </div>
              <div className="set-meta">
                <span className="badge" style={{ background: '#00e676', color: '#090c15', fontWeight: 800 }}>ALL SETS COMBINED</span>
                <span>• Showing all cards in your collection</span>
                {setValue > 0 && (
                  <span className="badge" style={{ background: 'rgba(0, 230, 118, 0.2)', borderColor: '#00e676', color: '#00e676', fontWeight: 800 }}>
                    <Euro size={12} style={{ verticalAlign: 'middle' }} /> Portfolio Value: €{setValue.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => onBackup && onBackup('all')}
              title="Download full collection text backup (.txt)"
              style={{ background: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.35)', color: 'var(--color-primary)' }}
            >
              <Download size={15} />
              <span>Backup Collection (.txt)</span>
            </button>
            <label
              className="btn btn-secondary"
              style={{ cursor: 'pointer', background: 'rgba(255, 255, 255, 0.08)' }}
              title="Restore full collection from a .txt backup file"
            >
              <Upload size={15} />
              <span>Restore (.txt)</span>
              <input
                type="file"
                accept=".txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onRestore && onRestore(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div className="progress-container">
          <div className="progress-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={18} color="#00e676" />
              <span style={{ fontWeight: 700, color: '#fff' }}>Total Binder Count</span>
            </div>
            <div>
              <span className="progress-stats-num">{ownedCount}</span>
              <span style={{ color: 'var(--text-muted)' }}> cards owned across all sets</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!set) return null;

  const totalCards = cardsCount || set.total || 0;
  const percentage = totalCards > 0 ? ((ownedCount / totalCards) * 100).toFixed(1) : 0;
  const isComplete = totalCards > 0 && ownedCount >= totalCards;

  return (
    <div className="set-banner">
      <div className="set-header-row">
        <div className="set-info-left">
          {set.images?.logo ? (
            <img src={set.images.logo} alt={set.name} className="set-logo" />
          ) : (
            <Flame size={48} color="var(--color-primary)" />
          )}
          <div className="set-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1>{set.name}</h1>
              {set.images?.symbol && (
                <img src={set.images.symbol} alt="symbol" style={{ height: 24, width: 24, objectFit: 'contain' }} />
              )}
            </div>
            <div className="set-meta">
              <span className="badge">{set.series}</span>
              {set.releaseDate && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={14} /> Released {set.releaseDate}
                </span>
              )}
              {setValue > 0 && (
                <span className="badge" style={{ background: 'rgba(0, 230, 118, 0.15)', borderColor: 'rgba(0, 230, 118, 0.4)', color: '#00e676', fontWeight: 800 }}>
                  <Euro size={12} style={{ verticalAlign: 'middle' }} /> Set Value: €{setValue.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onBackup && onBackup(set?.id)}
            title={`Download text backup of cards collected for ${set?.name}`}
            style={{ background: 'rgba(0, 229, 255, 0.1)', borderColor: 'rgba(0, 229, 255, 0.3)', color: 'var(--color-primary)' }}
          >
            <Download size={15} />
            <span>Backup Set (.txt)</span>
          </button>

          <label
            className="btn btn-secondary"
            style={{ cursor: 'pointer', background: 'rgba(255, 204, 0, 0.1)', borderColor: 'rgba(255, 204, 0, 0.3)', color: 'var(--color-accent)' }}
            title="Restore set cards from a .txt backup file"
          >
            <Upload size={15} />
            <span>Restore Set (.txt)</span>
            <input
              type="file"
              accept=".txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onRestore && onRestore(e.target.files[0], set?.id);
                  e.target.value = '';
                }
              }}
            />
          </label>

          <button
            className="btn btn-secondary"
            onClick={onMarkAll}
            title="Mark all cards in this set as owned"
          >
            <CheckCircle2 size={16} color="var(--color-success)" />
            <span>Mark All Owned</span>
          </button>
          <button
            className="btn btn-danger"
            onClick={onClearAll}
            title="Reset ownership for this set"
          >
            <Trash2 size={16} />
            <span>Clear Set</span>
          </button>
        </div>
      </div>

      <div className="progress-container">
        <div className="progress-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={18} color={isComplete ? '#00e676' : 'var(--color-accent)'} />
            <span style={{ fontWeight: 700, color: '#fff' }}>Set Completion Progress</span>
            {isComplete && <span className="badge" style={{ background: '#00e676', color: '#090c15' }}>100% COMPLETE! 🎉</span>}
          </div>
          <div>
            <span className="progress-stats-num">{ownedCount}</span>
            <span style={{ color: 'var(--text-muted)' }}> / {totalCards} cards ({percentage}%)</span>
          </div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
