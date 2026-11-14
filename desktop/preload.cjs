// Bridge between the web app and the desktop shell: native open / save dialogs and image export.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: p => ipcRenderer.invoke('read-file', p),
  saveFile: (p, text) => ipcRenderer.invoke('save-file', p, text),
  saveFileAs: (name, text) => ipcRenderer.invoke('save-file-as', name, text),
  saveImage: (name, dataUrl) => ipcRenderer.invoke('save-image', name, dataUrl),
});
