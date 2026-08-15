/**
 * Electron Preload Script for AdHub Pro
 * Exposes a secure IPC bridge (window.desktopAPI) to the React renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  
  // Backup Events
  onBackupStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('desktop:backup-status', subscription);
    return () => {
      ipcRenderer.removeListener('desktop:backup-status', subscription);
    };
  },

  // Trigger Backup manually
  triggerBackup: () => ipcRenderer.invoke('desktop:trigger-backup'),

  // List Available Local Backups
  listBackups: () => ipcRenderer.invoke('desktop:list-backups'),

  // Select Backup File
  selectBackupFile: () => ipcRenderer.invoke('desktop:select-backup-file'),

  // Restore Backup to Local DB
  restoreBackup: (payload) => ipcRenderer.invoke('desktop:restore-backup', payload),

  // Restore Progress Events
  onRestoreProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('desktop:restore-progress', subscription);
    return () => {
      ipcRenderer.removeListener('desktop:restore-progress', subscription);
    };
  },

  // Local Supabase & Docker Stack Management
  getLocalStackStatus: () => ipcRenderer.invoke('desktop:get-local-stack-status'),
  ensureLocalStackRunning: () => ipcRenderer.invoke('desktop:ensure-local-stack-running'),
  startLocalStack: () => ipcRenderer.invoke('desktop:start-local-stack'),
  stopLocalStack: () => ipcRenderer.invoke('desktop:stop-local-stack'),
  onLocalStackProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('desktop:local-stack-progress', subscription);
    return () => {
      ipcRenderer.removeListener('desktop:local-stack-progress', subscription);
    };
  },
  onLocalStackStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('desktop:local-stack-status', subscription);
    return () => {
      ipcRenderer.removeListener('desktop:local-stack-status', subscription);
    };
  },

  // Open the local backups folder in Windows Explorer
  openBackupsFolder: () => ipcRenderer.invoke('desktop:open-backups-folder'),

  // Get App Information
  getAppInfo: () => ipcRenderer.invoke('desktop:get-app-info'),

  // Native High-Quality PDF Export (Save as PDF like Google Chrome)
  saveAsPDF: (options) => ipcRenderer.invoke('desktop:save-as-pdf', options),

  // Native Print Dialog
  printDocument: (options) => ipcRenderer.invoke('desktop:print-document', options),
});
