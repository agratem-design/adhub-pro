const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximizeToggle: () => ipcRenderer.invoke('window-maximize-toggle'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  readClipboardFile: () => ipcRenderer.invoke('read-clipboard-file'),
  selectFiles: () => ipcRenderer.invoke('select-files-dialog'),
  uploadToGoogleDrive: (data) => ipcRenderer.invoke('upload-to-google-drive', data),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-changed', (event, data) => callback(data));
  },
});
