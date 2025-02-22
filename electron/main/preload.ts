import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    docker: {
      start: () => ipcRenderer.invoke('docker:start'),
      stop: () => ipcRenderer.invoke('docker:stop'),
      status: () => ipcRenderer.invoke('docker:status'),
      systemStatus: () => ipcRenderer.invoke('docker:systemStatus'),
      toggle: (start: boolean) => ipcRenderer.invoke('docker:toggle', start),
      getServices: () => ipcRenderer.invoke('docker:getServices'),
      getLogs: (serviceName: string) => ipcRenderer.invoke('docker:getLogs', serviceName),
      clearLogs: (serviceName: string) => ipcRenderer.invoke('docker:clearLogs', serviceName),
      startService: (serviceName: string) => ipcRenderer.invoke('docker:startService', serviceName),
      stopService: (serviceName: string) => ipcRenderer.invoke('docker:stopService', serviceName),
      restartService: (serviceName: string) => ipcRenderer.invoke('docker:restartService', serviceName),
    }
  }
); 