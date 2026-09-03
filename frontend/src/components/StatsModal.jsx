import React from 'react';
import { X, PieChart, Trophy, Layers, Euro, CheckCircle } from 'lucide-react';

export default function StatsModal({ stats, sets, onClose, onSelectSet }) {
  if (!stats) return null;

  const setCounts = stats.set_counts || {};
  const setValues = stats.set_values || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ gridTemplateColumns: '1fr', maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="brand-icon">
            <PieChart size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Collection Portfolio & Valuation</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Permanently saved in your Django SQLite database</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
          <div style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.2)', padding: '1.25rem', borderRadius: 12, textAlign: 'center' }}>
            <Trophy size={28} color="var(--color-primary)" style={{ marginBottom: 4 }} />
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>{stats.total_collected || 0}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Cards Collected</div>
          </div>

          <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.2)', padding: '1.25rem', borderRadius: 12, textAlign: 'center' }}>
            <Euro size={28} color="var(--color-success)" style={{ marginBottom: 4 }} />
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00e676' }}>
              €{(stats.total_market_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Est. Total Market Value</div>
          </div>

          <div style={{ background: 'rgba(255, 204, 0, 0.08)', border: '1px solid rgba(255, 204, 0, 0.2)', padding: '1.25rem', borderRadius: 12, textAlign: 'center' }}>
            <Layers size={28} color="var(--color-accent)" style={{ marginBottom: 4 }} />
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>{stats.total_sets_tracked || 0}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sets Tracked</div>
          </div>
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.8rem' }}>Set Breakdown & Estimated Value</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.4rem' }}>
          {Object.keys(setCounts).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No cards collected yet. Click any gray card to add it!</p>
          ) : (
            Object.entries(setCounts).map(([setId, count]) => {
              const setObj = sets.find(s => s.id === setId);
              const setName = setObj ? setObj.name : setId;
              const totalInSet = setObj ? setObj.total : 0;
              const val = setValues[setId] || 0;
              const pct = totalInSet > 0 ? ((count / totalInSet) * 100).toFixed(0) : null;

              return (
                <div
                  key={setId}
                  onClick={() => {
                    onSelectSet(setId);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '0.6rem 1rem',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {setObj?.images?.symbol ? (
                      <img src={setObj.images.symbol} alt="set" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                    ) : (
                      <CheckCircle size={16} color="var(--color-primary)" />
                    )}
                    <span style={{ fontWeight: 600, color: '#fff' }}>{setName}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#00e676', display: 'block' }}>
                      {count} {totalInSet > 0 ? `/ ${totalInSet} (${pct}%)` : 'cards'}
                    </span>
                    {val > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>€{val.toFixed(2)} est.</span>}
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
