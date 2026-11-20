import React, { useEffect, useState } from 'react';
import { FolderOpen, FolderSearch, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import type { AppConfig, TargetKind, TargetProvider } from '../types';

interface SettingsViewProps {
  config: AppConfig;
  onSaveConfig: (next: AppConfig) => Promise<void>;
  onResetTargets: () => Promise<void>;
  onOpenFolder: (path: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig,
  onResetTargets,
  onOpenFolder,
}) => {
  const [libraryPath, setLibraryPath] = useState(config.libraryPath);

  useEffect(() => {
    setLibraryPath(config.libraryPath);
  }, [config.libraryPath]);
  const [customName, setCustomName] = useState('');
  const [customProvider, setCustomProvider] = useState<TargetProvider>('custom');
  const [customKind, setCustomKind] = useState<TargetKind>('custom');
  const [customPath, setCustomPath] = useState('');

  const handleBrowseLibrary = async () => {
    const picked = await window.llmSkillz.pickFolder(libraryPath);
    if (picked) {
      setLibraryPath(picked);
      await onSaveConfig({ ...config, libraryPath: picked });
    }
  };

  const handleAddCustomTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPath.trim()) return;
    const id = `custom-${Date.now()}`;
    await onSaveConfig({
      ...config,
      targets: [
        ...config.targets,
        {
          id,
          name: customName.trim(),
          provider: customProvider,
          kind: customKind,
          path: customPath.trim(),
          enabled: true,
        },
      ],
    });
    setCustomName('');
    setCustomPath('');
  };

  const handleRemoveTarget = async (targetId: string) => {
    await onSaveConfig({
      ...config,
      targets: config.targets.filter((t) => t.id !== targetId),
    });
  };

  return (
    <div className="main-content">
      <div className="page-scroll">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">
              Manage your source skills library folder and custom LLM target directories.
            </p>
          </div>
        </div>

        {/* Library Folder */}
        <section className="provider-section">
          <div className="provider-heading">Source Skills Library</div>
          <div className="card" style={{ maxWidth: 760 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Every subfolder containing a <code style={{ fontFamily: 'var(--font-mono)' }}>SKILL.md</code> is loaded as a skill. Nested subfolders automatically create sections in the sidebar.
            </div>
            <div className="path-row" style={{ marginBottom: 0 }}>
              <input
                type="text"
                className="input input-mono"
                value={libraryPath}
                onChange={(e) => setLibraryPath(e.target.value)}
                onBlur={() => {
                  if (libraryPath.trim() && libraryPath.trim() !== config.libraryPath) {
                    onSaveConfig({ ...config, libraryPath: libraryPath.trim() });
                  }
                }}
              />
              <button className="btn btn-sm" onClick={handleBrowseLibrary}>
                <FolderSearch size={14} />
                Browse
              </button>
              <button className="btn btn-sm" onClick={() => onOpenFolder(config.libraryPath)}>
                <FolderOpen size={14} />
                Open
              </button>
            </div>
          </div>
        </section>

        {/* Add Custom Target */}
        <section className="provider-section">
          <div className="provider-heading">Add Custom LLM Target</div>
          <form className="card" style={{ maxWidth: 760 }} onSubmit={handleAddCustomTarget}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="form-label">Target Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Cursor Skills"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Provider</label>
                <select
                  className="input"
                  value={customProvider}
                  onChange={(e) => setCustomProvider(e.target.value as TargetProvider)}
                >
                  <option value="custom">Custom</option>
                  <option value="antigravity">Antigravity</option>
                  <option value="claude">Claude</option>
                  <option value="codex">Codex</option>
                </select>
              </div>
              <div>
                <label className="form-label">Type</label>
                <select
                  className="input"
                  value={customKind}
                  onChange={(e) => setCustomKind(e.target.value as TargetKind)}
                >
                  <option value="app">App</option>
                  <option value="cli">CLI</option>
                  <option value="custom">Other</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Skills Destination Folder</label>
              <div className="path-row" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  className="input input-mono"
                  placeholder="C:\Users\...\skills"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={async () => {
                    const picked = await window.llmSkillz.pickFolder(customPath);
                    if (picked) setCustomPath(picked);
                  }}
                >
                  <FolderSearch size={14} />
                  Browse
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-sm">
              <Plus size={14} />
              Add Target
            </button>
          </form>
        </section>

        {/* Manage Configured Targets */}
        <section className="provider-section">
          <div className="provider-heading" style={{ justifyContent: 'space-between', maxWidth: 760 }}>
            <span>Configured Targets ({config.targets.length})</span>
            <button
              className="btn btn-xs"
              onClick={() => {
                if (window.confirm('Reset all targets back to default Antigravity, Claude, and Codex paths?')) {
                  onResetTargets();
                }
              }}
            >
              <RotateCcw size={12} />
              Reset Defaults
            </button>
          </div>

          <div className="card" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {config.targets.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <ProviderIcon provider={t.provider} size={18} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{t.name}</span>
                      {t.kind !== 'custom' && <span className="kind-tag">{t.kind}</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {t.path}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => handleRemoveTarget(t.id)}
                  title="Remove target"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
