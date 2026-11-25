import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FilePlus,
  FileText,
  FolderOpen,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ProviderIcon } from './ProviderIcon';
import type { InstallState, SkillRecord, TargetStatus } from '../types';

type EditorMode = 'preview' | 'split' | 'edit';

interface SkillWorkspaceProps {
  skill: SkillRecord;
  targets: TargetStatus[];
  onSaveFile: (skillId: string, relativePath: string, content: string) => Promise<void>;
  onDeleteFile: (skillId: string, relativePath: string) => Promise<void>;
  onDeleteSkill: (skillId: string) => Promise<void>;
  onInstallSkill: (skillId: string, targetId: string) => Promise<void>;
  onUninstallSkill: (skillId: string, targetId: string) => Promise<void>;
  onInstallAllTargets: (skillId: string) => Promise<void>;
  onOpenFolder: (fullPath: string) => void;
}

function splitFrontmatter(raw: string): { entries: [string, string][]; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { entries: [], body: normalized };

  const entries: [string, string][] = [];
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      entries.push([kv[1].trim(), kv[2].trim()]);
    } else if (entries.length > 0 && (line.startsWith('  ') || line.startsWith('\t'))) {
      const last = entries[entries.length - 1];
      last[1] = `${last[1]} ${line.trim()}`.trim();
    }
  }
  return { entries, body: match[2] };
}

export const SkillWorkspace: React.FC<SkillWorkspaceProps> = ({
  skill,
  targets,
  onSaveFile,
  onDeleteFile,
  onDeleteSkill,
  onInstallSkill,
  onUninstallSkill,
  onInstallAllTargets,
  onOpenFolder,
}) => {
  const [activeFile, setActiveFile] = useState<string>(skill.entryFile);
  const [content, setContent] = useState<string>(skill.rawContent);
  const [savedContent, setSavedContent] = useState<string>(skill.rawContent);
  const [mode, setMode] = useState<EditorMode>('preview');
  const [saving, setSaving] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [addingFile, setAddingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  const isDirty = content !== savedContent;
  const enabledTargets = useMemo(() => targets.filter((t) => t.enabled), [targets]);

  // Reset active file when switching skills
  useEffect(() => {
    setActiveFile(skill.entryFile);
    setContent(skill.rawContent);
    setSavedContent(skill.rawContent);
    setAddingFile(false);
    setNewFilePath('');
  }, [skill.id]);

  // Load selected file content
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await window.llmSkillz.readSkillFile(skill.id, activeFile);
      if (!cancelled) {
        setContent(res.content);
        setSavedContent(res.content);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skill.id, activeFile]);

  const handleSave = async () => {
    if (saving || !isDirty) return;
    setSaving(true);
    try {
      await onSaveFile(skill.id, activeFile, content);
      setSavedContent(content);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const isMarkdown = activeFile.toLowerCase().endsWith('.md');

  const renderedPreview = useMemo(() => {
    if (!isMarkdown) return null;
    const { entries, body } = splitFrontmatter(content);
    const rawHtml = marked.parse(body, { gfm: true, breaks: false }) as string;
    const safeHtml = DOMPurify.sanitize(rawHtml);
    return { entries, safeHtml };
  }, [content, isMarkdown]);

  const handleCreateExtraFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFilePath.trim().replace(/^[/\\]+/, '');
    if (!trimmed) return;
    await onSaveFile(skill.id, trimmed, '');
    setActiveFile(trimmed);
    setAddingFile(false);
    setNewFilePath('');
    setMode('edit');
  };

  const handleTargetAction = async (targetId: string, action: 'install' | 'uninstall') => {
    setBusyTargetId(targetId);
    try {
      if (action === 'install') {
        await onInstallSkill(skill.id, targetId);
      } else {
        await onUninstallSkill(skill.id, targetId);
      }
    } finally {
      setBusyTargetId(null);
    }
  };

  const handleInstallAll = async () => {
    setBusyTargetId('ALL');
    try {
      await onInstallAllTargets(skill.id);
    } finally {
      setBusyTargetId(null);
    }
  };

  const renderStatusText = (state: InstallState) => {
    if (state === 'installed') return 'On disk';
    if (state === 'outdated') return 'Update available';
    return 'Not installed';
  };

  return (
    <div className="main-content">
      {/* Header */}
      <header className="workspace-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="workspace-title-row">
            <h1 className="workspace-title">{skill.name}</h1>
            <span className="folder-chip">{skill.folderName}/</span>
            {skill.section !== 'General' && (
              <span className="badge badge-provider">{skill.section}</span>
            )}
          </div>
          {skill.description && <p className="workspace-desc">{skill.description}</p>}
        </div>

        <div className="workspace-actions">
          <button
            className="btn btn-sm"
            onClick={() => onOpenFolder(skill.fullPath)}
            title="Open skill folder in File Explorer"
          >
            <FolderOpen size={14} />
            Open Folder
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleInstallAll}
            disabled={busyTargetId !== null || enabledTargets.length === 0}
          >
            <Download size={14} />
            Install to All ({enabledTargets.length})
          </button>

          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (
                window.confirm(
                  `Delete skill "${skill.name}" (${skill.folderName}) from your library?\nInstalled copies in LLM target folders will remain untouched.`
                )
              ) {
                onDeleteSkill(skill.id);
              }
            }}
            title="Delete skill from library"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* Target Installation Matrix */}
      <section className="target-strip">
        <div className="target-strip-header">
          <span className="target-strip-label">Install to LLM Targets</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Compares local files in <code style={{ fontFamily: 'var(--font-mono)' }}>{skill.folderName}/</code>. Each app discovers skills separately.
          </span>
        </div>

        <div className="target-pills-grid">
          {enabledTargets.map((target) => {
            const state: InstallState = skill.installStatus[target.id] || 'not-installed';
            const isBusy = busyTargetId === target.id || busyTargetId === 'ALL';

            return (
              <div key={target.id} className={`target-pill-card ${state}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <ProviderIcon provider={target.provider} size={20} />
                  <div className="target-pill-info">
                    <div className="target-pill-name">
                      <span className={`status-dot ${state}`} />
                      <span>{target.name}</span>
                      {target.kind !== 'custom' && (
                        <span className="kind-tag">{target.kind}</span>
                      )}
                    </div>
                    <div className="target-pill-state">{renderStatusText(state)}</div>
                  </div>
                </div>

                <div className="target-pill-actions">
                  {state === 'not-installed' && (
                    <button
                      className="btn btn-primary btn-xs"
                      disabled={isBusy}
                      onClick={() => handleTargetAction(target.id, 'install')}
                    >
                      <Download size={12} />
                      Install
                    </button>
                  )}

                  {state === 'outdated' && (
                    <>
                      <button
                        className="btn btn-warning btn-xs"
                        disabled={isBusy}
                        onClick={() => handleTargetAction(target.id, 'install')}
                      >
                        <RefreshCw size={12} />
                        Update
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={isBusy}
                        title="Uninstall from this target"
                        onClick={() => handleTargetAction(target.id, 'uninstall')}
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}

                  {state === 'installed' && (
                    <>
                      <span className="badge badge-installed" style={{ padding: '2px 6px' }}>
                        <CheckCircle2 size={11} />
                        Files match
                      </span>
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={isBusy}
                        title="Uninstall from this target"
                        onClick={() => handleTargetAction(target.id, 'uninstall')}
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* File Tabs & Mode Toolbar */}
      <div className="editor-toolbar">
        <div className="file-tabs">
          {(skill.files.length > 0 ? skill.files : [skill.entryFile]).map((file) => {
            const isCurrent = file === activeFile;
            const isEntry = file.toLowerCase() === 'skill.md';
            return (
              <button
                key={file}
                className={`file-tab ${isCurrent ? 'active' : ''}`}
                onClick={() => {
                  if (isDirty && !window.confirm('Discard unsaved changes to current file?')) {
                    return;
                  }
                  setActiveFile(file);
                }}
              >
                <FileText size={13} />
                <span>{file}</span>
                {isCurrent && isDirty && <span className="dirty-dot" title="Unsaved changes" />}
                {!isEntry && isCurrent && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete file "${file}" from ${skill.folderName}?`)) {
                        onDeleteFile(skill.id, file).then(() => setActiveFile(skill.entryFile));
                      }
                    }}
                    title="Delete file"
                    style={{ display: 'inline-flex', marginLeft: 2, color: 'var(--text-muted)' }}
                  >
                    <X size={12} />
                  </span>
                )}
              </button>
            );
          })}

          {addingFile ? (
            <form onSubmit={handleCreateExtraFile} style={{ display: 'inline-flex', gap: 4 }}>
              <input
                type="text"
                className="input input-mono"
                style={{ width: 180, padding: '3px 7px', fontSize: 12 }}
                placeholder="e.g. scripts/helper.py"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-xs">
                Add
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setAddingFile(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setAddingFile(true)}
              title="Add supporting file (scripts/, references/, etc.)"
            >
              <FilePlus size={13} />
              Add File
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMarkdown && (
            <div className="mode-switcher">
              <button
                className={`mode-btn ${mode === 'preview' ? 'active' : ''}`}
                onClick={() => setMode('preview')}
              >
                Read
              </button>
              <button
                className={`mode-btn ${mode === 'split' ? 'active' : ''}`}
                onClick={() => setMode('split')}
              >
                Split
              </button>
              <button
                className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
                onClick={() => setMode('edit')}
              >
                Edit
              </button>
            </div>
          )}

          <button
            className={`btn btn-sm ${isDirty ? 'btn-primary' : ''}`}
            disabled={!isDirty || saving}
            onClick={handleSave}
            title="Save changes (Ctrl+S)"
          >
            <Save size={14} />
            {saving ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="editor-body">
        {(mode === 'edit' || mode === 'split' || !isMarkdown) && (
          <div className="editor-pane">
            <textarea
              className="code-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              placeholder="Write your skill instructions in Markdown..."
            />
          </div>
        )}

        {isMarkdown && (mode === 'preview' || mode === 'split') && renderedPreview && (
          <div className="preview-pane">
            {renderedPreview.entries.length > 0 && (
              <div className="frontmatter-card">
                {renderedPreview.entries.map(([k, v]) => (
                  <div key={k} className="frontmatter-row">
                    <span className="frontmatter-key">{k}</span>
                    <span className="frontmatter-val">{v}</span>
                  </div>
                ))}
              </div>
            )}
            <article
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: renderedPreview.safeHtml }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
