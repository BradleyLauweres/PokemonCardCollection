import React, { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Cloud,
  Download,
  Upload,
  Key,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  getGitHubConfig,
  saveGitHubConfig,
  getSyncState,
  subscribeSyncState,
  pushToGitHub,
  pullFromGitHub,
  testGitHubConnection,
  backupCollection,
  restoreCollection
} from '../api';

export default function GitHubSettingsModal({ onClose, onCollectionUpdated }) {
  const [config, setConfig] = useState(getGitHubConfig());
  const [syncState, setSyncState] = useState(getSyncState());
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    const unsub = subscribeSyncState((st) => setSyncState(st));
    return () => unsub();
  }, []);

  const handleChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleSave = (e) => {
    if (e) e.preventDefault();
    saveGitHubConfig(config);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      saveGitHubConfig(config);
      const res = await testGitHubConnection(config);
      setTestResult({
        success: true,
        message: `Connected successfully to ${res.repoName}! File "${config.path}" ${res.fileExists ? `found with ${res.remoteCardsCount} cards.` : 'will be created on first sync.'}`
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushNow = async () => {
    setIsPushing(true);
    try {
      saveGitHubConfig(config);
      await pushToGitHub();
      alert('✓ Successfully pushed collection to your GitHub repository!');
    } catch (err) {
      alert(`Failed to push to GitHub: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullNow = async () => {
    if (!window.confirm('Pulling from GitHub will update your local cards with the file in your repository. Continue?')) {
      return;
    }
    setIsPulling(true);
    try {
      saveGitHubConfig(config);
      await pullFromGitHub();
      alert('✓ Successfully pulled and updated collection from GitHub!');
      if (onCollectionUpdated) onCollectionUpdated();
    } catch (err) {
      alert(`Failed to pull from GitHub: ${err.message}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleDownloadFile = async () => {
    try {
      const data = await backupCollection();
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'collection.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await restoreCollection({ file });
      alert(`✓ ${res.message}!`);
      if (onCollectionUpdated) onCollectionUpdated();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const isConfigured = !!(config.token && config.token.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ gridTemplateColumns: '1fr', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
          <div className="brand-icon" style={{ background: 'linear-gradient(135deg, #24292e, #1f2328)' }}>
            <Cloud size={22} color="var(--color-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>GitHub Cloud Sync</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Store your card collection in your GitHub repository — no database or backend server needed.
            </p>
          </div>
        </div>

        {/* Current Live Status Banner */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 12,
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            background:
              syncState.status === 'synced'
                ? 'rgba(0, 230, 118, 0.1)'
                : syncState.status === 'syncing' || syncState.status === 'pending'
                ? 'rgba(255, 204, 0, 0.1)'
                : syncState.status === 'error'
                ? 'rgba(255, 82, 82, 0.12)'
                : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${
              syncState.status === 'synced'
                ? 'rgba(0, 230, 118, 0.3)'
                : syncState.status === 'syncing' || syncState.status === 'pending'
                ? 'rgba(255, 204, 0, 0.3)'
                : syncState.status === 'error'
                ? 'rgba(255, 82, 82, 0.35)'
                : 'rgba(255, 255, 255, 0.1)'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {syncState.status === 'synced' && <CheckCircle2 size={22} color="var(--color-success)" />}
            {(syncState.status === 'syncing' || syncState.status === 'pending') && (
              <RefreshCw size={22} color="var(--color-accent)" className="spin-animation" />
            )}
            {syncState.status === 'error' && <AlertCircle size={22} color="var(--color-danger)" />}
            {syncState.status === 'unconfigured' && <GitBranch size={22} color="var(--text-muted)" />}

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                {syncState.status === 'synced' && 'Synced with GitHub'}
                {syncState.status === 'syncing' && 'Saving collection to GitHub...'}
                {syncState.status === 'pending' && 'Unsaved changes pending commit...'}
                {syncState.status === 'error' && 'Sync Error'}
                {syncState.status === 'unconfigured' && 'Local Storage Mode (GitHub not configured)'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {syncState.status === 'synced' && syncState.lastSyncedAt && (
                  <>Last synced: {new Date(syncState.lastSyncedAt).toLocaleTimeString()}</>
                )}
                {syncState.status === 'error' && syncState.lastError && (
                  <span style={{ color: 'var(--color-danger)' }}>{syncState.lastError}</span>
                )}
                {syncState.status === 'unconfigured' && (
                  <>Your cards are safely saved in your browser. Configure GitHub below to sync across devices.</>
                )}
              </div>
            </div>
          </div>

          {isConfigured && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={handlePullNow}
                disabled={isPulling || isPushing}
                title="Download newest collection from GitHub"
              >
                <RefreshCw size={14} className={isPulling ? 'spin-animation' : ''} />
                <span>Pull</span>
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={handlePushNow}
                disabled={isPushing || isPulling}
                title="Upload local collection to GitHub"
              >
                <Upload size={14} className={isPushing ? 'spin-animation' : ''} />
                <span>Push</span>
              </button>
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                GitHub Username / Org
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. BradleyLauweres"
                value={config.owner}
                onChange={(e) => handleChange('owner', e.target.value.trim())}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '0.6rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Repository Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. PokemonCardCollection"
                value={config.repo}
                onChange={(e) => handleChange('repo', e.target.value.trim())}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '0.6rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Branch
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="main"
                value={config.branch}
                onChange={(e) => handleChange('branch', e.target.value.trim())}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '0.6rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Collection File Path
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="collection.json"
                value={config.path}
                onChange={(e) => handleChange('path', e.target.value.trim())}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '0.6rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          {/* Personal Access Token */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                GitHub Personal Access Token (PAT)
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=PokeTrack+TCG+Sync"
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  textDecoration: 'none'
                }}
              >
                <span>Generate Token on GitHub</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                className="form-control"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_xxxxxxxx"
                value={config.token}
                onChange={(e) => handleChange('token', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '0.6rem 2.5rem 0.6rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Requires a Classic Token with <strong>repo</strong> scope or a Fine-Grained Token with <strong>Contents: Read & Write</strong> access.
            </p>
          </div>

          {/* Optional Pokémon TCG API Key */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Pokémon TCG API Key <span style={{ opacity: 0.6 }}>(Optional)</span>
              </label>
              <a
                href="https://pokemontcg.io"
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  textDecoration: 'none'
                }}
              >
                <span>Get Free Key (20,000 req/day)</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <input
              type="text"
              className="form-control"
              placeholder="Optional: Enter API key for faster card loading"
              value={config.tcgApiKey}
              onChange={(e) => handleChange('tcgApiKey', e.target.value.trim())}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '0.6rem 0.85rem',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* Security Notice */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 8,
              background: 'rgba(0, 229, 255, 0.05)',
              border: '1px solid rgba(0, 229, 255, 0.15)',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start'
            }}
          >
            <ShieldCheck size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <strong>Zero-server security:</strong> Your GitHub token is stored only in your browser's local storage.
              It is sent directly to <code style={{ color: 'var(--color-primary)' }}>api.github.com</code> and is never transmitted anywhere else.
            </div>
          </div>

          {/* Test Connection Result Alert */}
          {testResult && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: testResult.success ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 82, 82, 0.12)',
                border: `1px solid ${testResult.success ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 82, 82, 0.35)'}`,
                color: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isTesting || !config.token}
              style={{ flex: 1 }}
            >
              <Key size={16} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {saveSuccessMsg ? (
                <>
                  <Check size={16} />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Cloud size={16} />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Offline File Backup & Restore Options */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
            Offline File Backup & Restore
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadFile}
              style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
            >
              <Download size={15} />
              <span>Download collection.json</span>
            </button>

            <label
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', cursor: 'pointer', textAlign: 'center' }}
            >
              <Upload size={15} />
              <span>Import from File</span>
              <input
                type="file"
                accept=".json,.txt"
                onChange={handleUploadFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
