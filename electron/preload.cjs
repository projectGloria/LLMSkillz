const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('llmSkillz', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChanged: (callback) => {
    const listener = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window:maximizedChanged', listener);
    return () => ipcRenderer.removeListener('window:maximizedChanged', listener);
  },

  getState: () => ipcRenderer.invoke('app:getState'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  resetTargets: () => ipcRenderer.invoke('config:resetTargets'),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pickFolder', defaultPath),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),

  readSkillFile: (skillId, relativePath) =>
    ipcRenderer.invoke('skill:readFile', { skillId, relativePath }),
  writeSkillFile: (skillId, relativePath, content) =>
    ipcRenderer.invoke('skill:writeFile', { skillId, relativePath, content }),
  deleteSkillFile: (skillId, relativePath) =>
    ipcRenderer.invoke('skill:deleteFile', { skillId, relativePath }),
  createSkill: (payload) => ipcRenderer.invoke('skill:create', payload),
  deleteSkill: (skillId) => ipcRenderer.invoke('skill:delete', { skillId }),

  installSkill: (skillId, targetId) =>
    ipcRenderer.invoke('skill:install', { skillId, targetId }),
  uninstallSkill: (skillId, targetId) =>
    ipcRenderer.invoke('skill:uninstall', { skillId, targetId }),
  installSkillAllTargets: (skillId) =>
    ipcRenderer.invoke('skill:installAllTargets', { skillId }),

  syncTargetAllSkills: (targetId) =>
    ipcRenderer.invoke('target:syncAllSkills', { targetId }),
  importSkillFromTarget: (targetId, folderName) =>
    ipcRenderer.invoke('target:importSkill', { targetId, folderName }),
});
