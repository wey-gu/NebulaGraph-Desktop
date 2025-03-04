import { contextBridge, ipcRenderer } from 'electron';

console.log('🔄 Preload script starting...');

// Type declarations for error handling
interface ElectronError extends Error {
  message: string;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  health: {
    status: 'healthy' | 'unhealthy' | 'starting' | 'unknown';
    lastCheck: string;
    failureCount: number;
  };
  metrics: {
    cpu: string;
    memory: string;
    network: string;
    uptime?: number;
    connections?: number;
  } | null;
  ports: string[];
  logs: string[];
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: string;
}

interface DockerSystemStatus {
  isInstalled: boolean;
  isRunning: boolean;
  version?: string;
  compose?: {
    isInstalled: boolean;
    version?: string;
  };
  error?: string;
}

interface DockerAPI {
  status: () => Promise<boolean>;
  systemStatus: () => Promise<DockerSystemStatus>;
  start: () => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean; error?: string }>;
  getServices: () => Promise<Record<string, ServiceStatus>>;
  startService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  stopService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  restartService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  getLogs: (serviceName: string) => Promise<Array<LogEntry>>;
  getImageLoadingProgress: () => Promise<number | null>;
  ensureImagesLoaded: () => Promise<boolean>;
}

// Create the API object with error handling and logging
const docker: DockerAPI = {
  status: async () => {
    try {
      return await ipcRenderer.invoke('docker:status');
    } catch (error) {
      console.error('Docker status error:', error);
      return false;
    }
  },
  systemStatus: async () => {
    try {
      return await ipcRenderer.invoke('docker:systemStatus');
    } catch (error) {
      console.error('Docker system status error:', error);
      return {
        isInstalled: false,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  start: async () => {
    try {
      return await ipcRenderer.invoke('docker:start');
    } catch (error) {
      console.error('Docker start error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
  stop: async () => {
    try {
      return await ipcRenderer.invoke('docker:stop');
    } catch (error) {
      console.error('Docker stop error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
  getServices: async () => {
    try {
      return await ipcRenderer.invoke('docker:getServices');
    } catch (error) {
      console.error('Get services error:', error);
      return {};
    }
  },
  startService: async (serviceName: string) => {
    try {
      return await ipcRenderer.invoke('docker:startService', serviceName);
    } catch (error) {
      console.error('Start service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
  stopService: async (serviceName: string) => {
    try {
      return await ipcRenderer.invoke('docker:stopService', serviceName);
    } catch (error) {
      console.error('Stop service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
  restartService: async (serviceName: string) => {
    try {
      return await ipcRenderer.invoke('docker:restartService', serviceName);
    } catch (error) {
      console.error('Restart service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
  getImageLoadingProgress: async () => {
    try {
      return await ipcRenderer.invoke('docker:getImageLoadingProgress');
    } catch (error) {
      console.error('Get image loading progress error:', error);
      return null;
    }
  },
  ensureImagesLoaded: async () => {
    try {
      return await ipcRenderer.invoke('docker:ensureImagesLoaded');
    } catch (error) {
      console.error('Ensure images loaded error:', error);
      return false;
    }
  },
  getLogs: async (serviceName: string) => {
    try {
      return await ipcRenderer.invoke('docker:getLogs', serviceName);
    } catch (error) {
      console.error('Get logs error:', error);
      return [];
    }
  }
};

// Add log handling
ipcRenderer.on('log', (_, log) => {
  const { level, message, timestamp } = log;
  const formattedMessage = `${message}`;
  
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
});

// Expose the API to the renderer process
try {
  console.log('🔌 Exposing Electron API...');
  contextBridge.exposeInMainWorld('electronAPI', {
    docker: docker,
    browser: {
      openExternal: (url: string) => ipcRenderer.invoke('browser:openExternal', url)
    },
    logs: {
      subscribe: (callback: (log: any) => void) => {
        const subscription = (_: any, log: any) => callback(log);
        ipcRenderer.on('log', subscription);
        return () => ipcRenderer.removeListener('log', subscription);
      }
    }
  });
  console.log('✓ Electron API exposed successfully');
} catch (error) {
  console.error('✕ Failed to expose Electron API:', error);
} 