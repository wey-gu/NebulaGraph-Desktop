export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'not_created';
  health: {
    status: 'healthy' | 'unhealthy' | 'starting' | 'unknown' | 'not_created';
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
  status: () => Promise<boolean>;
  systemStatus: () => Promise<DockerSystemStatus>;
  start: () => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean; error?: string }>;
  getServices: () => Promise<Record<string, ServiceStatus>>;
  startService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  stopService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  restartService: (serviceName: string) => Promise<{ success: boolean; error?: string }>;
  getLogs: (serviceName: string) => Promise<Array<LogEntry>>;
  getImageLoadingProgress: () => Promise<{ current: number; total: number; status: string } | null>;
  ensureImagesLoaded: () => Promise<boolean>;
}

export interface MainProcessLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

declare global {
  interface Window {
    electronAPI: {
      docker: DockerAPI;
      browser: {
        openExternal: (url: string) => Promise<boolean>;
      };
      logs: {
        subscribe: (callback: (log: MainProcessLog) => void) => () => void;
      };
    };
  }
} 