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

export default function GitHubSettingsModal({
  onClose,
  onCollectionUpdated
}) {
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
      alert('Successfully pushed collection to your GitHub repository!');
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
      alert('Successfully pulled and updated collection from GitHub!');
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
      alert(`${res.message}!`);
      if (onCollectionUpdated) onCollectionUpdated();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const isConfigured = !!(config.token && config.owner && config.repo);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ gridTemplateColumns: '1fr', maxWidth: 620 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            className="brand-icon"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))'
            }}
          >
            <GitBranch size={22} color="#090c15" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              GitHub Cloud Sync Settings
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Seamlessly persist and sync your collection to your personal GitHub repository
            </p>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            padding: '1rem',
            margin: '0.8rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Current Sync Status
            </span>
            <span
              className="badge"
              style={{
                background:
                  syncState.status === 'synced'
                    ? 'rgba(0, 230, 118, 0.15)'
                    : syncState.status === 'syncing'
                    ? 'rgba(0, 229, 255, 0.15)'
                    : syncState.status === 'error'
                    ? 'rgba(255, 82, 82, 0.15)'
                    : syncState.status === 'pending'
                    ? 'rgba(255, 204, 0, 0.15)'
                    : 'rgba(255, 255, 255, 0.08)',
                color:
                  syncState.status === 'synced'
                    ? 'var(--color-success)'
                    : syncState.status === 'syncing'
                    ? 'var(--color-primary)'
                    : syncState.status === 'error'
                    ? 'var(--color-danger)'
                    : syncState.status === 'pending'
                    ? 'var(--color-accent)'
                    : 'var(--text-muted)',
                borderColor:
                  syncState.status === 'synced'
                    ? 'var(--color-success)'
                    : syncState.status === 'error'
                    ? 'var(--color-danger)'
                    : undefined
              }}
            >
              {syncState.status === 'synced' && 'Synced with GitHub'}
              {syncState.status === 'syncing' && 'Saving to GitHub...'}
              {syncState.status === 'pending' && `Changes Pending (${syncState.pendingChangesCount || 1})`}
              {syncState.status === 'error' && 'Sync Error'}
              {syncState.status === 'unconfigured' && 'Not Configured'}
              {syncState.status === 'idle' && 'Ready to Sync'}
            </span>
          </div>

          {syncState.lastSyncedAt && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Last synced: {new Date(syncState.lastSyncedAt).toLocaleString()}
            </div>
          )}

          {syncState.lastError && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-danger)',
                background: 'rgba(255, 82, 82, 0.1)',
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                border: '1px solid rgba(255, 82, 82, 0.2)'
              }}
            >
              {syncState.lastError}
            </div>
          )}

          {isConfigured && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePushNow}
                disabled={isPushing}
                style={{ flex: 1, fontSize: '0.82rem', padding: '0.45rem 0.8rem' }}
                title="Force push current local cards to GitHub"
              >
                <Cloud size={14} />
                <span>{isPushing ? 'Pushing...' : 'Push Now'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePullNow}
                disabled={isPulling}
                style={{ flex: 1, fontSize: '0.82rem', padding: '0.45rem 0.8rem' }}
                title="Pull and merge cards from your GitHub repository"
              >
                <RefreshCw size={14} className={isPulling ? 'spin-animation' : ''} />
                <span>{isPulling ? 'Pulling...' : 'Pull Now'}</span>
              </button>
            </div>
          )}
        </div>

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
