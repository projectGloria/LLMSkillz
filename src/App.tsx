import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Sidebar, type ActiveView } from './components/Sidebar';
import { SkillWorkspace } from './components/SkillWorkspace';
import { TargetsView } from './components/TargetsView';
import { SettingsView } from './components/SettingsView';
import { NewSkillModal } from './components/NewSkillModal';
import { TitleBar } from './components/TitleBar';
import type { AppConfig, AppState } from './types';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('skill');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadState = useCallback(async () => {
    try {
      const data = await window.llmSkillz.getState();
      setState(data);
      setSelectedSkillId((prev) => {
        if (prev && data.skills.some((s) => s.id === prev)) return prev;
        return data.skills[0]?.id ?? null;
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load skills', 'error');
    }
  }, [notify]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const applyState = useCallback((next: AppState) => {
    setState(next);
    setSelectedSkillId((prev) => {
      if (prev && next.skills.some((s) => s.id === prev)) return prev;
      return next.skills[0]?.id ?? null;
    });
  }, []);

  const selectedSkill = useMemo(() => {
    if (!state || !selectedSkillId) return null;
    return state.skills.find((s) => s.id === selectedSkillId) ?? null;
  }, [state, selectedSkillId]);

  const existingSections = useMemo(() => {
    if (!state) return [];
    return Array.from(new Set(state.skills.map((s) => s.section)));
  }, [state]);

  const handleSaveFile = async (skillId: string, relativePath: string, content: string) => {
    const next = await window.llmSkillz.writeSkillFile(skillId, relativePath, content);
    applyState(next);
    notify(`Saved ${relativePath}`);
  };

  const handleDeleteFile = async (skillId: string, relativePath: string) => {
    const next = await window.llmSkillz.deleteSkillFile(skillId, relativePath);
    applyState(next);
    notify(`Deleted ${relativePath}`);
  };

  const handleCreateSkill = async (payload: {
    folderName: string;
    section?: string;
    name?: string;
    description?: string;
  }) => {
    const res = await window.llmSkillz.createSkill(payload);
    setState({ config: res.config, skills: res.skills, targets: res.targets });
    setSelectedSkillId(res.createdId);
    setActiveView('skill');
    notify(`Created skill "${payload.name || payload.folderName}"`);
  };

  const handleDeleteSkill = async (skillId: string) => {
    const next = await window.llmSkillz.deleteSkill(skillId);
    applyState(next);
    notify('Deleted skill from library');
  };

  const handleInstallSkill = async (skillId: string, targetId: string) => {
    try {
      const next = await window.llmSkillz.installSkill(skillId, targetId);
      applyState(next);
      const targetName = next.targets.find((t) => t.id === targetId)?.name || targetId;
      notify(`Installed to ${targetName}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Install failed', 'error');
    }
  };

  const handleUninstallSkill = async (skillId: string, targetId: string) => {
    try {
      const next = await window.llmSkillz.uninstallSkill(skillId, targetId);
      applyState(next);
      const targetName = next.targets.find((t) => t.id === targetId)?.name || targetId;
      notify(`Removed from ${targetName}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Uninstall failed', 'error');
    }
  };

  const handleInstallAllTargets = async (skillId: string) => {
    try {
      const next = await window.llmSkillz.installSkillAllTargets(skillId);
      applyState(next);
      notify('Installed skill to all enabled LLM targets');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Batch install failed', 'error');
    }
  };

  const handleSyncTarget = async (targetId: string) => {
    try {
      const next = await window.llmSkillz.syncTargetAllSkills(targetId);
      applyState(next);
      const targetName = next.targets.find((t) => t.id === targetId)?.name || targetId;
      notify(`Synced all skills to ${targetName}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Sync failed', 'error');
    }
  };

  const handleImportSkill = async (targetId: string, folderName: string) => {
    try {
      const res = await window.llmSkillz.importSkillFromTarget(targetId, folderName);
      setState({ config: res.config, skills: res.skills, targets: res.targets });
      setSelectedSkillId(res.importedId);
      notify(`Imported "${folderName}" into library`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Import failed', 'error');
    }
  };

  const handleSaveConfig = async (nextConfig: AppConfig) => {
    const next = await window.llmSkillz.saveConfig(nextConfig);
    applyState(next);
    notify('Configuration saved');
  };

  const handleResetTargets = async () => {
    const next = await window.llmSkillz.resetTargets();
    applyState(next);
    notify('Targets reset to defaults');
  };

  const handleOpenFolder = async (folderPath: string) => {
    const res = await window.llmSkillz.openPath(folderPath);
    if (!res.ok && res.error) {
      notify(res.error, 'error');
    }
  };

  if (!state) {
    return (
      <div className="app-frame">
        <TitleBar subtitle="Loading..." />
        <div className="empty-state">
          <img src="./icon.png" alt="LLMSkillz" />
          <p>Loading your LLM skills library...</p>
        </div>
      </div>
    );
  }

  const titlebarSubtitle =
    activeView === 'targets'
      ? 'Targets & Sync'
      : activeView === 'settings'
      ? 'Settings'
      : selectedSkill?.name || 'Library';

  return (
    <div className="app-frame">
      <TitleBar subtitle={titlebarSubtitle} />
      <div className="app-shell">
      <Sidebar
        skills={state.skills}
        targets={state.targets}
        selectedSkillId={selectedSkillId}
        activeView={activeView}
        onSelectSkill={(id) => {
          setSelectedSkillId(id);
          setActiveView('skill');
        }}
        onSelectView={setActiveView}
        onOpenNewSkill={() => setShowNewModal(true)}
        onRefresh={async () => {
          await loadState();
          notify('Library refreshed');
        }}
      />

      {activeView === 'skill' && selectedSkill ? (
        <SkillWorkspace
          skill={selectedSkill}
          targets={state.targets}
          onSaveFile={handleSaveFile}
          onDeleteFile={handleDeleteFile}
          onDeleteSkill={handleDeleteSkill}
          onInstallSkill={handleInstallSkill}
          onUninstallSkill={handleUninstallSkill}
          onInstallAllTargets={handleInstallAllTargets}
          onOpenFolder={handleOpenFolder}
        />
      ) : activeView === 'skill' ? (
        <div className="empty-state">
          <img src="./icon.png" alt="LLMSkillz" />
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>No Skills Selected</h2>
          <p style={{ maxWidth: 420, marginBottom: 18 }}>
            Create a new custom LLM skill or point Settings to your skills folder to get started.
          </p>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={15} />
            Create Your First Skill
          </button>
        </div>
      ) : null}

      {activeView === 'targets' && (
        <TargetsView
          config={state.config}
          skills={state.skills}
          targets={state.targets}
          onSaveConfig={handleSaveConfig}
          onSyncTarget={handleSyncTarget}
          onImportSkill={handleImportSkill}
          onOpenFolder={handleOpenFolder}
        />
      )}

      {activeView === 'settings' && (
        <SettingsView
          config={state.config}
          onSaveConfig={handleSaveConfig}
          onResetTargets={handleResetTargets}
          onOpenFolder={handleOpenFolder}
        />
      )}

      {showNewModal && (
        <NewSkillModal
          existingSections={existingSections}
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreateSkill}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} color="#34d399" />
          ) : (
            <AlertCircle size={16} color="#fb7185" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
      </div>
    </div>
  );
};
