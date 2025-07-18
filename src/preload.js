/**
 * Creating a secure bridge between the renderer and the main process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: async () => {
    try {
      const result = await ipcRenderer.invoke('open-and-read-file');
      return result;
    } catch (error) {
      console.error("Couldn't open or read the file", error);
      return { canceled: true, error: error.message };
    }
  }
});