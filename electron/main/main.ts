import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { DockerService } from './services/docker-service';

// Simple development mode check
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

let mainWindow: BrowserWindow | null = null;
const dockerService = new DockerService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '..', 'preload', 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    console.log('Preload script path:', path.join(__dirname, '..', 'preload', 'preload.js'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('docker:status', async () => {
  return dockerService.checkDockerStatus();
});

ipcMain.handle('docker:toggle', async (_, start: boolean) => {
  if (start) {
    await dockerService.startServices();
  } else {
    await dockerService.stopServices();
  }
  return dockerService.checkDockerStatus();
});

ipcMain.handle('docker:start', async () => {
  return dockerService.startServices();
});

ipcMain.handle('docker:stop', async () => {
  return dockerService.stopServices();
});

ipcMain.handle('docker:services', async () => {
  return dockerService.getServicesStatus();
});

ipcMain.handle('docker:logs', async (_, serviceName: string) => {
  return dockerService.getServiceLogs(serviceName);
});

ipcMain.handle('docker:startService', async (_, serviceName: string) => {
  return dockerService.startService(serviceName);
});

ipcMain.handle('docker:stopService', async (_, serviceName: string) => {
  return dockerService.stopService(serviceName);
});

ipcMain.handle('docker:restartService', async (_, serviceName: string) => {
  return dockerService.restartService(serviceName);
});

// Ensure app is ready before creating window
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 