import { contextBridge, ipcRenderer } from 'electron';

console.log('🔄 Preload script starting...');

// Type declarations for error handling
interface ElectronError extends Error {
  message: string;
}

// Type declarations for our API
interface DockerAPI {
  start: () => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean; error?: string }>;
  status: () => Promise<boolean>;
  toggle: (start: boolean) => Promise<boolean>;
  getServices: () => Promise<any[]>;
  getLogs: (serviceName: string) => Promise<any[]>;
  startService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  stopService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  restartService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
}

// Create the API object with error handling and logging
const api: DockerAPI = {
  start: async () => {
    console.log('📦 Calling docker:start');
    try {
      const result = await ipcRenderer.invoke('docker:start');
      console.log('✓ docker:start result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:start error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },
  stop: async () => {
    console.log('🛑 Calling docker:stop');
    try {
      const result = await ipcRenderer.invoke('docker:stop');
      console.log('✓ docker:stop result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:stop error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },
  status: async () => {
    console.log('🔍 Calling docker:status');
    try {
      const result = await ipcRenderer.invoke('docker:status');
      console.log('✓ docker:status result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:status error:', error);
      return false;
    }
  },
  toggle: async (start: boolean) => {
    console.log(`🔄 Calling docker:toggle(${start})`);
    try {
      const result = await ipcRenderer.invoke('docker:toggle', start);
      console.log('✓ docker:toggle result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:toggle error:', error);
      return false;
    }
  },
  getServices: async () => {
    console.log('📋 Calling docker:services');
    try {
      const result = await ipcRenderer.invoke('docker:services');
      console.log('✓ docker:services result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:services error:', error);
      return [];
    }
  },
  getLogs: async (serviceName: string) => {
    console.log(`📜 Calling docker:logs for ${serviceName}`);
    try {
      const result = await ipcRenderer.invoke('docker:logs', serviceName);
      console.log('✓ docker:logs result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:logs error:', error);
      return [];
    }
  },
  startService: async (serviceName: string) => {
    console.log(`▶️ Calling docker:startService for ${serviceName}`);
    try {
      const result = await ipcRenderer.invoke('docker:startService', serviceName);
      console.log('✓ docker:startService result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:startService error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },
  stopService: async (serviceName: string) => {
    console.log(`⏹️ Calling docker:stopService for ${serviceName}`);
    try {
      const result = await ipcRenderer.invoke('docker:stopService', serviceName);
      console.log('✓ docker:stopService result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:stopService error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },
  restartService: async (serviceName: string) => {
    console.log(`🔄 Calling docker:restartService for ${serviceName}`);
    try {
      const result = await ipcRenderer.invoke('docker:restartService', serviceName);
      console.log('✓ docker:restartService result:', result);
      return result;
    } catch (err) {
      const error = err as ElectronError;
      console.error('✕ docker:restartService error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },
};

// Expose the API to the renderer process
try {
  console.log('🔌 Exposing Electron API...');
  contextBridge.exposeInMainWorld('electronAPI', {
    docker: api
  });
  console.log('✓ Electron API exposed successfully');
} catch (error) {
  console.error('✕ Failed to expose Electron API:', error);
} 