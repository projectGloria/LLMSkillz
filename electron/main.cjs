const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.vscode']);

function getDefaultLibraryPath() {
  const appDir = app.getAppPath();
  const candidates = [
    path.join(appDir, 'skills'),
    path.join(process.cwd(), 'skills'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return candidates[0];
}

function getDefaultTargets() {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

  return [
    {
      id: 'antigravity-app',
      name: 'Antigravity App',
      provider: 'antigravity',
      kind: 'app',
      path: path.join(home, '.gemini', 'antigravity', 'skills'),
      enabled: true,
    },
    {
      id: 'antigravity-cli',
      name: 'Antigravity CLI',
      provider: 'antigravity',
      kind: 'cli',
      path: path.join(home, '.gemini', 'config', 'skills'),
      enabled: true,
    },
    {
      id: 'claude-app',
      name: 'Claude App',
      provider: 'claude',
      kind: 'app',
      path: path.join(appData, 'Claude', 'skills'),
      enabled: true,
    },
    {
      id: 'claude-cli',
      name: 'Claude CLI',
      provider: 'claude',
      kind: 'cli',
      path: path.join(home, '.claude', 'skills'),
      enabled: true,
    },
    {
      id: 'codex-app',
      name: 'Codex App',
      provider: 'codex',
      kind: 'app',
      path: path.join(home, '.codex', 'skills'),
      enabled: true,
    },
    {
      id: 'codex-cli',
      name: 'Codex CLI',
      provider: 'codex',
      kind: 'cli',
      path: path.join(home, '.agents', 'skills'),
      enabled: true,
    },
  ];
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'llmskillz-config.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  const defaults = {
    libraryPath: getDefaultLibraryPath(),
    targets: getDefaultTargets(),
  };

  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        libraryPath: raw.libraryPath || defaults.libraryPath,
        targets: Array.isArray(raw.targets) && raw.targets.length > 0 ? raw.targets : defaults.targets,
      };
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return defaults;
}

function saveConfig(config) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

function findSkillEntryFile(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') {
      return entry.name;
    }
  }
  return null;
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: normalized };
  }

  const rawYaml = match[1];
  const body = match[2];
  const frontmatter = {};

  let currentKey = null;
  for (const line of rawYaml.split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1].trim();
      let val = kv[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      frontmatter[currentKey] = val;
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      frontmatter[currentKey] = `${frontmatter[currentKey]} ${line.trim()}`.trim();
    }
  }

  return { frontmatter, body };
}

function listFilesRecursive(dirPath, baseDir = dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, baseDir));
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      results.push(rel);
    }
  }
  return results.sort((a, b) => {
    if (a.toLowerCase() === 'skill.md') return -1;
    if (b.toLowerCase() === 'skill.md') return 1;
    return a.localeCompare(b);
  });
}

function hashDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const files = listFilesRecursive(dirPath);
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    hash.update(rel.toLowerCase());
    hash.update('\0');
    const buf = fs.readFileSync(path.join(dirPath, rel));
    hash.update(buf);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function getLatestMtime(dirPath, files) {
  let latest = 0;
  for (const rel of files) {
    try {
      const stat = fs.statSync(path.join(dirPath, rel));
      if (stat.mtimeMs > latest) latest = stat.mtimeMs;
    } catch {
      // ignore
    }
  }
  return latest;
}

function buildSkillRecord(skillDir, relativeId, section, targets) {
  const folderName = path.basename(skillDir);
  const entryFile = findSkillEntryFile(skillDir);
  const files = listFilesRecursive(skillDir);

  let rawContent = '';
  if (entryFile) {
    try {
      rawContent = fs.readFileSync(path.join(skillDir, entryFile), 'utf8');
    } catch {
      rawContent = '';
    }
  }

  const { frontmatter, body } = parseFrontmatter(rawContent);
  const fallbackDesc = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('---')) || '';

  const hash = hashDirectory(skillDir);
  const updatedAt = getLatestMtime(skillDir, files);

  const installStatus = {};
  for (const target of targets) {
    const destDir = path.join(target.path, folderName);
    if (!fs.existsSync(destDir)) {
      installStatus[target.id] = 'not-installed';
    } else {
      const destHash = hashDirectory(destDir);
      installStatus[target.id] = destHash === hash ? 'installed' : 'outdated';
    }
  }

  return {
    id: relativeId,
    folderName,
    section: section || 'General',
    fullPath: skillDir,
    entryFile: entryFile || 'SKILL.md',
    hasEntryFile: Boolean(entryFile),
    name: frontmatter.name || folderName,
    description: frontmatter.description || fallbackDesc,
    rawContent,
    files,
    hash,
    updatedAt,
    installStatus,
  };
}

function scanSkills(config) {
  const libraryPath = config.libraryPath;
  if (!libraryPath || !fs.existsSync(libraryPath)) {
    return [];
  }

  const skills = [];
  const entries = fs.readdirSync(libraryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
      continue;
    }

    const dirPath = path.join(libraryPath, entry.name);
    const hasDirectSkill = Boolean(findSkillEntryFile(dirPath));

    if (hasDirectSkill) {
      skills.push(buildSkillRecord(dirPath, entry.name, null, config.targets));
    } else {
      // Check if this folder is a category/section folder containing skill subfolders
      const children = fs.readdirSync(dirPath, { withFileTypes: true }).filter(
        (c) => c.isDirectory() && !IGNORED_DIRS.has(c.name) && !c.name.startsWith('.')
      );
      const nestedSkillDirs = children.filter((c) => Boolean(findSkillEntryFile(path.join(dirPath, c.name))));

      if (nestedSkillDirs.length > 0) {
        for (const child of nestedSkillDirs) {
          const childPath = path.join(dirPath, child.name);
          const relId = `${entry.name}/${child.name}`;
          skills.push(buildSkillRecord(childPath, relId, entry.name, config.targets));
        }
      } else {
        // Folder without SKILL.md yet — still show it so user can initialize/edit it
        skills.push(buildSkillRecord(dirPath, entry.name, null, config.targets));
      }
    }
  }

  return skills.sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

function scanTargets(config, skills) {
  const libraryFolderNames = new Set(skills.map((s) => s.folderName.toLowerCase()));

  return config.targets.map((target) => {
    const exists = fs.existsSync(target.path);
    const installedFolders = [];
    const untrackedFolders = [];

    if (exists) {
      try {
        const entries = fs.readdirSync(target.path, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
          installedFolders.push(entry.name);
          if (!libraryFolderNames.has(entry.name.toLowerCase())) {
            untrackedFolders.push(entry.name);
          }
        }
      } catch (err) {
        console.error(`Failed scanning target ${target.path}:`, err);
      }
    }

    return {
      ...target,
      exists,
      installedFolders: installedFolders.sort(),
      untrackedFolders: untrackedFolders.sort(),
    };
  });
}

function resolveSkillDir(config, skillId) {
  const safeRel = skillId.replace(/\\/g, '/').split('/').filter((seg) => seg && seg !== '..' && seg !== '.');
  const full = path.resolve(config.libraryPath, ...safeRel);
  const libRoot = path.resolve(config.libraryPath);
  if (!full.startsWith(libRoot + path.sep) && full !== libRoot) {
    throw new Error('Invalid skill path');
  }
  return full;
}

function resolveFileInsideDir(baseDir, relPath) {
  const full = path.resolve(baseDir, relPath);
  const root = path.resolve(baseDir);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error('Invalid file path');
  }
  return full;
}

function copyDirClean(srcDir, destDir) {
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirClean(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'LLMSkillz.ico');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1020,
    minHeight: 680,
    backgroundColor: '#0b0e14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizedChanged', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizedChanged', false);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!process.env.VITE_DEV_SERVER_URL || !url.startsWith(process.env.VITE_DEV_SERVER_URL)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ======================== WINDOW CONTROLS ========================

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ======================== IPC HANDLERS ========================

ipcMain.handle('app:getState', () => {
  const config = loadConfig();
  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('config:save', (_event, nextConfig) => {
  const saved = saveConfig(nextConfig);
  const skills = scanSkills(saved);
  const targets = scanTargets(saved, skills);
  return { config: saved, skills, targets };
});

ipcMain.handle('config:resetTargets', () => {
  const current = loadConfig();
  const saved = saveConfig({
    ...current,
    targets: getDefaultTargets(),
  });
  const skills = scanSkills(saved);
  const targets = scanTargets(saved, skills);
  return { config: saved, skills, targets };
});

ipcMain.handle('dialog:pickFolder', async (_event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('shell:openPath', async (_event, targetPath) => {
  if (!targetPath) return { ok: false, error: 'No path provided' };
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const err = await shell.openPath(targetPath);
  return { ok: !err, error: err || null };
});

ipcMain.handle('skill:readFile', (_event, { skillId, relativePath }) => {
  const config = loadConfig();
  const skillDir = resolveSkillDir(config, skillId);
  const filePath = resolveFileInsideDir(skillDir, relativePath);
  if (!fs.existsSync(filePath)) {
    return { content: '', exists: false };
  }
  return { content: fs.readFileSync(filePath, 'utf8'), exists: true };
});

ipcMain.handle('skill:writeFile', (_event, { skillId, relativePath, content }) => {
  const config = loadConfig();
  const skillDir = resolveSkillDir(config, skillId);
  const filePath = resolveFileInsideDir(skillDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');

  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('skill:deleteFile', (_event, { skillId, relativePath }) => {
  const config = loadConfig();
  const skillDir = resolveSkillDir(config, skillId);
  const filePath = resolveFileInsideDir(skillDir, relativePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('skill:create', (_event, { folderName, section, name, description, body }) => {
  const config = loadConfig();
  const cleanFolder = folderName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleanFolder) {
    throw new Error('Folder name must contain alphanumeric characters.');
  }

  const cleanSection = section
    ? section
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : '';

  const targetDir = cleanSection
    ? path.join(config.libraryPath, cleanSection, cleanFolder)
    : path.join(config.libraryPath, cleanFolder);

  if (fs.existsSync(targetDir)) {
    throw new Error(`Skill folder "${cleanFolder}" already exists.`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const skillContent = [
    '---',
    `name: ${name?.trim() || cleanFolder}`,
    `description: ${description?.trim() || 'Custom LLM skill.'}`,
    '---',
    '',
    body?.trim() || `# ${name?.trim() || cleanFolder}\n\nDescribe when and how the agent should use this skill.\n\n## Workflow\n\n1. Inspect context.\n2. Execute steps.\n3. Verify output.\n`,
  ].join('\n');

  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillContent, 'utf8');

  const createdId = cleanSection ? `${cleanSection}/${cleanFolder}` : cleanFolder;
  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { createdId, config, skills, targets };
});

ipcMain.handle('skill:delete', (_event, { skillId }) => {
  const config = loadConfig();
  const skillDir = resolveSkillDir(config, skillId);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('skill:install', (_event, { skillId, targetId }) => {
  const config = loadConfig();
  const target = config.targets.find((t) => t.id === targetId);
  if (!target) throw new Error('Target not found');

  const skillDir = resolveSkillDir(config, skillId);
  const folderName = path.basename(skillDir);
  const destDir = path.join(target.path, folderName);

  fs.mkdirSync(target.path, { recursive: true });
  copyDirClean(skillDir, destDir);

  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('skill:uninstall', (_event, { skillId, targetId }) => {
  const config = loadConfig();
  const target = config.targets.find((t) => t.id === targetId);
  if (!target) throw new Error('Target not found');

  const skillDir = resolveSkillDir(config, skillId);
  const folderName = path.basename(skillDir);
  const destDir = path.join(target.path, folderName);

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('skill:installAllTargets', (_event, { skillId }) => {
  const config = loadConfig();
  const skillDir = resolveSkillDir(config, skillId);
  const folderName = path.basename(skillDir);

  for (const target of config.targets) {
    if (!target.enabled) continue;
    fs.mkdirSync(target.path, { recursive: true });
    copyDirClean(skillDir, path.join(target.path, folderName));
  }

  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { config, skills, targets };
});

ipcMain.handle('target:syncAllSkills', (_event, { targetId }) => {
  const config = loadConfig();
  const target = config.targets.find((t) => t.id === targetId);
  if (!target) throw new Error('Target not found');

  const skills = scanSkills(config);
  fs.mkdirSync(target.path, { recursive: true });

  for (const skill of skills) {
    copyDirClean(skill.fullPath, path.join(target.path, skill.folderName));
  }

  const updatedSkills = scanSkills(config);
  const updatedTargets = scanTargets(config, updatedSkills);
  return { config, skills: updatedSkills, targets: updatedTargets };
});

ipcMain.handle('target:importSkill', (_event, { targetId, folderName }) => {
  const config = loadConfig();
  const target = config.targets.find((t) => t.id === targetId);
  if (!target) throw new Error('Target not found');

  const srcDir = path.join(target.path, folderName);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Folder "${folderName}" not found in ${target.name}`);
  }

  const destDir = path.join(config.libraryPath, folderName);
  fs.mkdirSync(config.libraryPath, { recursive: true });
  copyDirClean(srcDir, destDir);

  const skills = scanSkills(config);
  const targets = scanTargets(config, skills);
  return { importedId: folderName, config, skills, targets };
});
