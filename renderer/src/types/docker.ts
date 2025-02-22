export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  health: 'healthy' | 'unhealthy' | 'starting' | 'unknown';
  metrics: {
    cpu: string;
    memory: string;
    network: string;
  } | null;
  ports: string[];
  logs: string[];
}

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'error' | 'warn';
}

export interface DockerSystemStatus {
  isInstalled: boolean;
  isRunning: boolean;
  version?: string;
  compose?: {
    isInstalled: boolean;
    version?: string;
  };
  error?: string;
}

export interface DockerStatus {
  isRunning: boolean;
  services: Record<string, ServiceStatus>;
  error?: string;
}

export interface DockerAPI {
  start: () => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean; error?: string }>;
  status: () => Promise<boolean>;
  systemStatus: () => Promise<DockerSystemStatus>;
  toggle: (start: boolean) => Promise<boolean>;
  getServices: () => Promise<Record<string, ServiceStatus>>;
  getLogs: (serviceName: string) => Promise<LogEntry[]>;
  clearLogs: (serviceName: string) => Promise<void>;
  startService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  stopService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  restartService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: {
      docker: DockerAPI;
    };
  }
} 