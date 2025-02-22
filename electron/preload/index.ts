import { contextBridge, ipcRenderer } from 'electron'

const docker = {
  status: () => ipcRenderer.invoke('docker:status'),
  systemStatus: () => ipcRenderer.invoke('docker:systemStatus'),
  toggle: (start: boolean) => ipcRenderer.invoke('docker:toggle', start),
} 