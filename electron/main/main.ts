import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DockerService } from './services/docker-service';
import { logger } from './utils/logger';

// Simple development mode check
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

let mainWindow: BrowserWindow | null = null;
const dockerService = new DockerService();

function createWindow() {
  if (!isDev) {
    // Register protocol handler for http scheme
    protocol.handle('http', (request) => {
      if (request.url.startsWith('http://localhost/')) {
        const filePath = request.url.replace('http://localhost/', '');
        logger.info('🔍 Looking for resource:', filePath);
        
        // Try multiple possible paths
        const possiblePaths = [
          // Try the direct app path first
          path.join(process.resourcesPath, 'app', filePath),
          // Try with public directory
          path.join(process.resourcesPath, 'app/public', filePath),
          // Try without public prefix
          path.join(process.resourcesPath, 'app', filePath.replace('public/', '')),
          // Try direct path for root files
          path.join(process.resourcesPath, 'app', path.basename(filePath)),
          // Try in the root app directory
          path.join(app.getAppPath(), filePath),
          // Try in the public directory of app path
          path.join(app.getAppPath(), 'public', filePath),
          // Try in the app's parent directory
          path.join(path.dirname(process.resourcesPath), 'app', filePath),
          // Try in the app's parent public directory
          path.join(path.dirname(process.resourcesPath), 'app/public', filePath),
          // Try in the resources directory
          path.join(process.resourcesPath, filePath),
          // Try in the resources public directory
          path.join(process.resourcesPath, 'public', filePath)
        ];

        // Log all paths we're going to check
        logger.info('📂 Will check these paths:');
        possiblePaths.forEach((p, i) => logger.info(`   ${i + 1}. ${p}`));
        
        // First verify the app directory exists and show its contents
        const appDir = path.join(process.resourcesPath, 'app');
        try {
          logger.info('\n📁 App directory contents:', appDir);
          const contents = fs.readdirSync(appDir);
          contents.forEach(item => {
            const stat = fs.statSync(path.join(appDir, item));
            logger.info(`   ${stat.isDirectory() ? '📂' : '📄'} ${item}`);
          });

          // Also show public directory contents if it exists
          const publicDir = path.join(appDir, 'public');
          if (fs.existsSync(publicDir)) {
            logger.info('\n📁 Public directory contents:', publicDir);
            const publicContents = fs.readdirSync(publicDir);
            publicContents.forEach(item => {
              const stat = fs.statSync(path.join(publicDir, item));
              logger.info(`   ${stat.isDirectory() ? '📂' : '📄'} ${item}`);
            });
          }
        } catch (error) {
          logger.error('❌ Failed to read directories:', error);
        }
        
        // Try each path
        for (const fullPath of possiblePaths) {
          logger.info('\n🔍 Checking:', fullPath);
          try {
            if (fs.existsSync(fullPath)) {
              // Read file and determine content type
              const fileContent = fs.readFileSync(fullPath);
              const ext = path.extname(fullPath).toLowerCase();
              let contentType = 'application/octet-stream';
              
              // Map common extensions to content types
              const contentTypes: Record<string, string> = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ico': 'image/x-icon',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf',
                '.eot': 'font/eot'
              };

              if (ext in contentTypes) {
                contentType = contentTypes[ext];
              }

              logger.info('✅ Found resource!');
              logger.info('   Path:', fullPath);
              logger.info('   Type:', contentType);
              logger.info('   Size:', fileContent.length, 'bytes');

              return new Response(fileContent, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000'
                }
              });
            }
          } catch (error) {
            logger.error('❌ Error checking path:', fullPath, error);
          }
        }

        logger.error('❌ Resource not found:', filePath);
        logger.error('   Tried all paths:', possiblePaths);
      }
      return new Response(null, { status: 404 });
    });
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      webSecurity: true
    }
  });

  // Set the window for the logger
  logger.setWindow(mainWindow);

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the app bundle
    const indexPath = path.join(process.resourcesPath, 'app/index.html');
    logger.info('Loading production index from:', indexPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
      logger.error('Failed to load index.html:', err);
      
      // Log all available paths
      const paths = {
        resourcesPath: process.resourcesPath,
        appPath: app.getAppPath(),
        userData: app.getPath('userData'),
        exe: app.getPath('exe'),
        cwd: process.cwd()
      };
      
      logger.info('Available paths:', paths);
      
      // List directory contents for debugging
      try {
        const appDir = path.join(process.resourcesPath, 'app');
        logger.info('App directory contents:', fs.readdirSync(appDir));
        
        // Also check the parent directory
        const parentDir = path.dirname(appDir);
        logger.info('Parent directory contents:', fs.readdirSync(parentDir));
      } catch (error) {
        logger.error('Failed to read directories:', error);
      }
    });
  }

  // Enable DevTools in production for debugging
  if (!isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow?.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('docker:status', async () => {
  return dockerService.checkDockerStatus();
});

ipcMain.handle('browser:openExternal', async (_, url: string) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('docker:systemStatus', async () => {
  return dockerService.getSystemStatus();
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

ipcMain.handle('docker:getServices', async () => {
  return dockerService.getServicesStatus();
});

ipcMain.handle('docker:getLogs', async (_, serviceName: string) => {
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