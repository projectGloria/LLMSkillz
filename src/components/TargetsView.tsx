import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FolderOpen,
  FolderSearch,
  Import,
  RefreshCw,
} from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import type { AppConfig, SkillRecord, TargetProvider, TargetStatus } from '../types';

interface TargetsViewProps {
  config: AppConfig;
  skills: SkillRecord[];
  targets: TargetStatus[];
  onSaveConfig: (next: AppConfig) => Promise<void>;
  onSyncTarget: (targetId: string) => Promise<void>;
  onImportSkill: (targetId: string, folderName: string) => Promise<void>;
  onOpenFolder: (path: string) => void;
}

const PROVIDER_LABELS: Record<TargetProvider, string> = {
  antigravity: 'Antigravity',
  claude: 'Claude',
  codex: 'Codex',
  custom: 'Custom Targets',
};

const PROVIDER_ORDER: TargetProvider[] = ['antigravity', 'claude', 'codex', 'custom'];

export const TargetsView: React.FC<TargetsViewProps> = ({
  config,
  skills,
  targets,
  onSaveConfig,
  onSyncTarget,
  onImportSkill,
  onOpenFolder,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingPaths, setEditingPaths] = useState<Record<string, string>>({});

  const updateTarget = async (targetId: string, patch: Partial<TargetStatus>) => {
    const nextTargets = config.targets.map((t) =>
      t.id === targetId ? { ...t, ...patch } : t
    );
    await onSaveConfig({ ...config, targets: nextTargets });
  };

  const handleBrowse = async (target: TargetStatus) => {
    const picked = await window.llmSkillz.pickFolder(target.path);
    if (picked) {
      setEditingPaths((prev) => ({ ...prev, [target.id]: picked }));
      await updateTarget(target.id, { path: picked });
    }
  };

  const handleSync = async (targetId: string) => {
    setBusyId(targetId);
    try {
      await onSyncTarget(targetId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="main-content">
      <div className="page-scroll">
        <div className="page-header">
          <div>
            <h1 className="page-title">LLM Targets &amp; Sync</h1>
            <p className="page-subtitle">
              Copy or import skills using local folders. Install ChatGPT workspace skills separately from the ChatGPT Skills page.
            </p>
          </div>
        </div>

        {PROVIDER_ORDER.map((provider) => {
          const group = targets.filter((t) => t.provider === provider);
          if (group.length === 0) return null;

          return (
            <section key={provider} className="provider-section">
              <div className="provider-heading">
                <ProviderIcon provider={provider} size={18} />
                <span>{PROVIDER_LABELS[provider]}</span>
              </div>

              <div className="cards-grid">
                {group.map((target) => {
                  const syncedCount = skills.filter(
                    (s) => s.installStatus[target.id] === 'installed'
                  ).length;
                  const outdatedCount = skills.filter(
                    (s) => s.installStatus[target.id] === 'outdated'
                  ).length;
                  const pathValue = editingPaths[target.id] ?? target.path;

                  return (
                    <div key={target.id} className="card">
                      <div className="card-header">
                        <div>
                          <div className="card-title">
                            <ProviderIcon provider={target.provider} size={20} />
                            <span>{target.name}</span>
                            {target.kind !== 'custom' && (
                              <span className="kind-tag">{target.kind}</span>
                            )}
                            {target.exists ? (
                              <span className="badge badge-installed">Folder Found</span>
                            ) : (
                              <span className="badge badge-missing">Will Create on Install</span>
                            )}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                            {syncedCount} / {skills.length} copies match
                            {outdatedCount > 0 && (
                              <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                                ({outdatedCount} outdated)
                              </span>
                            )}
                          </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={target.enabled}
                            onChange={(e) => updateTarget(target.id, { enabled: e.target.checked })}
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="path-row">
                        <input
                          type="text"
                          className="input input-mono"
                          value={pathValue}
                          onChange={(e) =>
                            setEditingPaths((prev) => ({ ...prev, [target.id]: e.target.value }))
                          }
                          onBlur={() => {
                            if (pathValue.trim() && pathValue.trim() !== target.path) {
                              updateTarget(target.id, { path: pathValue.trim() });
                            }
                          }}
                        />
                        <button
                          className="btn btn-sm"
                          onClick={() => handleBrowse(target)}
                          title="Browse for folder"
                        >
                          <FolderSearch size={14} />
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => onOpenFolder(target.path)}
                          title="Open in File Explorer"
                        >
                          <FolderOpen size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busyId !== null || skills.length === 0}
                          onClick={() => handleSync(target.id)}
                        >
                          {busyId === target.id ? (
                            <RefreshCw size={13} />
                          ) : (
                            <Download size={13} />
                          )}
                          Sync All {skills.length} Skills
                        </button>

                        {syncedCount === skills.length && skills.length > 0 && (
                          <span className="badge badge-installed">
                            <CheckCircle2 size={12} />
                            All Local Copies Match
                          </span>
                        )}
                      </div>

                      {target.untrackedFolders.length > 0 && (
                        <div className="untracked-box">
                          <div className="untracked-title">
                            Found in {target.name} (not in your library yet):
                          </div>
                          <div className="untracked-list">
                            {target.untrackedFolders.map((folder) => (
                              <span key={folder} className="untracked-chip">
                                <span>{folder}</span>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  style={{ padding: '1px 5px' }}
                                  onClick={() => onImportSkill(target.id, folder)}
                                  title="Copy into your LLMSkillz library"
                                >
                                  <Import size={12} />
                                  Import
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
