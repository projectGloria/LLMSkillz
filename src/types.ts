export type TargetProvider = 'antigravity' | 'claude' | 'codex' | 'custom';
export type TargetKind = 'app' | 'cli' | 'custom';
export type InstallState = 'installed' | 'outdated' | 'not-installed';

export interface TargetConfig {
  id: string;
  name: string;
  provider: TargetProvider;
  kind: TargetKind;
  path: string;
  enabled: boolean;
}

export interface TargetStatus extends TargetConfig {
  exists: boolean;
  installedFolders: string[];
  untrackedFolders: string[];
}

export interface SkillRecord {
  id: string;
  folderName: string;
  section: string;
  fullPath: string;
  entryFile: string;
  hasEntryFile: boolean;
  name: string;
  description: string;
  rawContent: string;
  files: string[];
  hash: string | null;
  updatedAt: number;
  installStatus: Record<string, InstallState>;
}

export interface AppConfig {
  libraryPath: string;
  targets: TargetConfig[];
}

export interface AppState {
  config: AppConfig;
  skills: SkillRecord[];
  targets: TargetStatus[];
}

export interface LLMSkillzAPI {
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;

  getState: () => Promise<AppState>;
  saveConfig: (config: AppConfig) => Promise<AppState>;
  resetTargets: () => Promise<AppState>;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
  openPath: (targetPath: string) => Promise<{ ok: boolean; error: string | null }>;

  readSkillFile: (skillId: string, relativePath: string) => Promise<{ content: string; exists: boolean }>;
  writeSkillFile: (skillId: string, relativePath: string, content: string) => Promise<AppState>;
  deleteSkillFile: (skillId: string, relativePath: string) => Promise<AppState>;
  createSkill: (payload: {
    folderName: string;
    section?: string;
    name?: string;
    description?: string;
    body?: string;
  }) => Promise<AppState & { createdId: string }>;
  deleteSkill: (skillId: string) => Promise<AppState>;

  installSkill: (skillId: string, targetId: string) => Promise<AppState>;
  uninstallSkill: (skillId: string, targetId: string) => Promise<AppState>;
  installSkillAllTargets: (skillId: string) => Promise<AppState>;

  syncTargetAllSkills: (targetId: string) => Promise<AppState>;
  importSkillFromTarget: (
    targetId: string,
    folderName: string
  ) => Promise<AppState & { importedId: string }>;
}

declare global {
  interface Window {
    llmSkillz: LLMSkillzAPI;
  }
}
