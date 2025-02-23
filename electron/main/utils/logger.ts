import { BrowserWindow } from 'electron';

class Logger {
  private mainWindow: BrowserWindow | null = null;

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private sendToRenderer(level: string, ...args: any[]) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('log', {
        level,
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        timestamp: new Date().toISOString()
      });
    }
  }

  info(...args: any[]) {
    console.log(...args);
    this.sendToRenderer('info', ...args);
  }

  warn(...args: any[]) {
    console.warn(...args);
    this.sendToRenderer('warn', ...args);
  }

  error(...args: any[]) {
    console.error(...args);
    this.sendToRenderer('error', ...args);
  }
}

export const logger = new Logger(); 