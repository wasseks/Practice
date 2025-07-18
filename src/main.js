/**
 * Main Electron process for creating a window and processing a file dialog.
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron/main')
const path = require('node:path')
const fs = require('fs').promises;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  console.log('Creating window');
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 320,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    console.log('Setting CSP for:', details.url);
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
        ],
      },
      
    });
  });

  const indexPath = path.join(__dirname, 'build', 'index.html');

  const serverUrl = 'http://localhost:5173';

  const loadApp = async () => {
    if (isDev) {
      console.log('Attempting to load from dev server:', serverUrl);
      try {
        await mainWindow.loadURL(serverUrl);
        console.log('Successfully loaded from dev server:', serverUrl);
      } catch (err) {
        console.error('Failed to load from dev server:', err);
        if (require('fs').existsSync(indexPath)) {
          console.log('Falling back to local file:', indexPath);
          await mainWindow.loadFile(indexPath);
          console.log('Successfully loaded local file:', indexPath);
        } else {
          console.error('No index.html found at:', indexPath);
          dialog.showErrorBox('Error', `Failed to load application. Ensure build/index.html exists. Path: ${indexPath}`);
          app.quit();
        }
      }
    } else {
      if (require('fs').existsSync(indexPath)) {
        console.log('Loading local file in production:', indexPath);
        await mainWindow.loadFile(indexPath);
        console.log('Successfully loaded:', indexPath);
      } else {
        console.error('No index.html found at:', indexPath);
        dialog.showErrorBox('Error', `Failed to load application. Ensure build/index.html exists. Path: ${indexPath}`);
        app.quit();
      }
    }
  };

  loadApp();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('Failed to initialize Electron app:', err);
  dialog.showErrorBox('Error', `Failed to initialize Electron: ${err.message}`);
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('open-and-read-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  try {
    const fileContent = await fs.readFile(filePath);
    return { data: JSON.parse(fileContent) };
  } catch (error) {
    console.error('Failed to read file:', error);
    return { canceled: true, error: error.message };
  }
});