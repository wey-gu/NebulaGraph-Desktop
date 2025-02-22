interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  ports?: string[];
  error?: string;
  health?: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: string;
    failureCount: number;
  };
  metrics?: {
    cpu: number;
    memory: number;
    uptime: number;
    connections: number;
  };
  dependencies?: {
    name: string;
    required: boolean;
    status: 'ok' | 'error' | 'warning';
  }[];
  config?: {
    version: string;
    dataPath?: string;
    logPath?: string;
    maxConnections?: number;
  };
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'error' | 'warn';
}

class DockerMockService {
  private services: Map<string, ServiceStatus>;
  private isDockerRunning: boolean;
  private serviceLogs: Map<string, LogEntry[]>;
  private logIntervals: Map<string, NodeJS.Timeout>;
  private metricIntervals: Map<string, NodeJS.Timeout>;

  constructor() {
    console.log('🐳 Initializing Docker mock service...')
    this.services = new Map();
    this.serviceLogs = new Map();
    this.logIntervals = new Map();
    this.metricIntervals = new Map();
    this.isDockerRunning = false;
    this.initializeServices();
    console.log('✓ Docker mock service initialized')
  }

  private initializeServices() {
    this.services.set('metad', {
      name: 'NebulaGraph Meta',
      status: 'stopped',
      ports: ['9559'],
      health: {
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        failureCount: 0
      },
      metrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        connections: 0
      },
      config: {
        version: 'v3.8.0',
        dataPath: '/data/meta',
        logPath: '/logs',
        maxConnections: 1000
      }
    });

    this.services.set('storaged', {
      name: 'NebulaGraph Storage',
      status: 'stopped',
      ports: ['9779'],
      health: {
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        failureCount: 0
      },
      metrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        connections: 0
      },
      dependencies: [
        { name: 'NebulaGraph Meta', required: true, status: 'ok' }
      ],
      config: {
        version: 'v3.8.0',
        dataPath: '/data/storage',
        logPath: '/logs',
        maxConnections: 1000
      }
    });

    this.services.set('graphd', {
      name: 'NebulaGraph Graph',
      status: 'stopped',
      ports: ['9669'],
      health: {
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        failureCount: 0
      },
      metrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        connections: 0
      },
      dependencies: [
        { name: 'NebulaGraph Meta', required: true, status: 'ok' },
        { name: 'NebulaGraph Storage', required: true, status: 'ok' }
      ],
      config: {
        version: 'v3.8.0',
        logPath: '/logs',
        maxConnections: 1000
      }
    });

    this.services.set('studio', {
      name: 'NebulaGraph Studio',
      status: 'stopped',
      ports: ['7001'],
      health: {
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        failureCount: 0
      },
      metrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        connections: 0
      },
      dependencies: [
        { name: 'NebulaGraph Graph', required: true, status: 'ok' }
      ],
      config: {
        version: 'v3.8.0'
      }
    });
  }

  private startLogging(serviceName: string) {
    if (!this.serviceLogs.has(serviceName)) {
      this.serviceLogs.set(serviceName, []);
    }

    // Clear any existing interval
    if (this.logIntervals.has(serviceName)) {
      clearInterval(this.logIntervals.get(serviceName));
    }

    const logs = this.serviceLogs.get(serviceName)!;
    const service = this.services.get(serviceName);

    // Add startup sequence logs
    logs.push(
      {
        timestamp: new Date().toISOString(),
        message: `Starting ${service?.name}...`,
        level: 'info'
      },
      {
        timestamp: new Date().toISOString(),
        message: 'Initializing service components...',
        level: 'info'
      },
      {
        timestamp: new Date().toISOString(),
        message: `Loading configuration from ${service?.config?.dataPath || '/data'}...`,
        level: 'info'
      },
      {
        timestamp: new Date().toISOString(),
        message: `Service ${service?.name} started successfully.`,
        level: 'info'
      }
    );

    // Simulate periodic log entries
    const interval = setInterval(() => {
      const service = this.services.get(serviceName);
      if (service?.status === 'running') {
        const metrics = service.metrics;
        if (metrics) {
          logs.push({
            timestamp: new Date().toISOString(),
            message: `Service health check passed. CPU: ${Math.round(metrics.cpu)}%, Memory: ${Math.round(metrics.memory)}MB, Connections: ${metrics.connections}`,
            level: Math.random() > 0.95 ? 'warn' : 'info'
          });
        }
      }
    }, 5000);

    this.logIntervals.set(serviceName, interval);
  }

  private stopLogging(serviceName: string) {
    if (this.logIntervals.has(serviceName)) {
      clearInterval(this.logIntervals.get(serviceName));
      this.logIntervals.delete(serviceName);
    }

    const logs = this.serviceLogs.get(serviceName);
    if (logs) {
      logs.push({
        timestamp: new Date().toISOString(),
        message: `Service ${serviceName} stopped gracefully.`,
        level: 'info'
      });
    }
  }

  private updateDependencyStatuses() {
    for (const [key, service] of this.services) {
      if (service.dependencies) {
        const updatedDeps = service.dependencies.map(dep => {
          const dependencyService = Array.from(this.services.values())
            .find(s => s.name === dep.name);
          
          let status: 'ok' | 'error' | 'warning';
          if (!dependencyService || dependencyService.status !== 'running') {
            status = 'error';
          } else if (dependencyService.health?.status === 'unhealthy') {
            status = 'warning';
          } else {
            status = 'ok';
          }

          return {
            ...dep,
            status
          };
        });

        this.services.set(key, {
          ...service,
          dependencies: updatedDeps
        });
      }
    }
  }

  private startMetrics(serviceName: string) {
    if (this.metricIntervals.has(serviceName)) {
      clearInterval(this.metricIntervals.get(serviceName));
    }

    const interval = setInterval(() => {
      const service = this.services.get(serviceName);
      if (service?.status === 'running') {
        // Existing metrics simulation
        const metrics = {
          cpu: Math.random() * 100,
          memory: Math.random() * 1024,
          uptime: (service.metrics?.uptime || 0) + 1,
          connections: Math.floor(Math.random() * 100)
        };

        // Health check simulation
        const healthStatus: 'healthy' | 'unhealthy' = Math.random() > 0.1 ? 'healthy' : 'unhealthy';
        const health = {
          status: healthStatus,
          lastCheck: new Date().toISOString(),
          failureCount: service.health?.failureCount || 0
        };

        if (health.status === 'unhealthy') {
          health.failureCount++;
        }

        this.services.set(serviceName, {
          ...service,
          health,
          metrics
        });

        // Update dependency statuses
        this.updateDependencyStatuses();
      }
    }, 2000);

    this.metricIntervals.set(serviceName, interval);
  }

  private stopMetrics(serviceName: string) {
    if (this.metricIntervals.has(serviceName)) {
      clearInterval(this.metricIntervals.get(serviceName));
      this.metricIntervals.delete(serviceName);
    }
  }

  async checkDockerStatus(): Promise<boolean> {
    console.log('🔍 Checking Docker status:', this.isDockerRunning)
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.isDockerRunning;
  }

  async toggleDocker(start: boolean): Promise<void> {
    console.log(`${start ? '▶️' : '⏹️'} Toggling Docker:`, start)
    await new Promise(resolve => setTimeout(resolve, 500));
    this.isDockerRunning = start;
    console.log('✓ Docker toggled:', this.isDockerRunning)
  }

  async startServices(): Promise<{ success: boolean; error?: string }> {
    console.log('▶️ Starting services...')
    if (!this.isDockerRunning) {
      console.error('✕ Cannot start services: Docker is not running')
      return { success: false, error: 'Docker is not running' };
    }

    // Simulate startup sequence
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start services in order: meta -> storage -> graph -> studio
    const startupSequence = ['metad', 'storaged', 'graphd', 'studio'];
    
    for (const serviceName of startupSequence) {
      console.log(`📦 Starting service: ${serviceName}`)
      const service = this.services.get(serviceName);
      if (!service) continue;

      // Check dependencies before starting
      if (service.dependencies) {
        const notRunning = service.dependencies.find(dep => {
          const depService = Array.from(this.services.values())
            .find(s => s.name === dep.name);
          return !depService || depService.status !== 'running';
        });

        if (notRunning) {
          const error = `Cannot start ${service.name}: dependency ${notRunning.name} is not running`;
          console.error('✕', error)
          return { success: false, error };
        }
      }

      // Simulate service startup time
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.services.set(serviceName, {
        ...service,
        status: 'running',
        health: {
          status: 'healthy',
          lastCheck: new Date().toISOString(),
          failureCount: 0
        },
        metrics: {
          cpu: 0,
          memory: 0,
          uptime: 0,
          connections: 0
        }
      });

      this.startLogging(service.name);
      this.startMetrics(service.name);
      this.updateDependencyStatuses();
      console.log(`✓ Service started: ${serviceName}`)
    }

    console.log('✓ All services started successfully')
    return { success: true };
  }

  async stopServices(): Promise<{ success: boolean; error?: string }> {
    console.log('⏹️ Stopping services...')
    if (!this.isDockerRunning) {
      console.error('✕ Cannot stop services: Docker is not running')
      return { success: false, error: 'Docker is not running' };
    }

    // Stop services in reverse order: studio -> graph -> storage -> meta
    const shutdownSequence = ['studio', 'graphd', 'storaged', 'metad'];
    
    for (const serviceName of shutdownSequence) {
      console.log(`📦 Stopping service: ${serviceName}`)
      const service = this.services.get(serviceName);
      if (!service) continue;

      // Check if any other services depend on this one
      const dependentServices = Array.from(this.services.values())
        .filter(s => s.status === 'running' && s.dependencies?.some(d => d.name === service.name && d.required));

      if (dependentServices.length > 0) {
        const error = `Cannot stop ${service.name}: required by ${dependentServices.map(s => s.name).join(', ')}`;
        console.error('✕', error)
        return { success: false, error };
      }

      // Simulate service shutdown time
      await new Promise(resolve => setTimeout(resolve, 500));

      this.services.set(serviceName, {
        ...service,
        status: 'stopped',
        health: {
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          failureCount: 0
        },
        metrics: {
          cpu: 0,
          memory: 0,
          uptime: 0,
          connections: 0
        }
      });

      this.stopLogging(service.name);
      this.stopMetrics(service.name);
      this.updateDependencyStatuses();
      console.log(`✓ Service stopped: ${serviceName}`)
    }

    console.log('✓ All services stopped successfully')
    return { success: true };
  }

  async getServicesStatus(): Promise<ServiceStatus[]> {
    console.log('📊 Getting services status...')
    await new Promise(resolve => setTimeout(resolve, 500));
    const services = Array.from(this.services.values());
    console.log('✓ Services status:', services)
    return services;
  }

  async getServiceLogs(serviceName: string): Promise<LogEntry[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.serviceLogs.get(serviceName) || [];
  }

  async clearServiceLogs(serviceName: string): Promise<void> {
    this.serviceLogs.set(serviceName, []);
  }

  async startService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isDockerRunning) {
      return { success: false, error: 'Docker is not running' };
    }

    const service = this.services.get(serviceName);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    // Check dependencies
    if (service.dependencies) {
      for (const dep of service.dependencies) {
        const depService = Array.from(this.services.values()).find(s => s.name === dep.name);
        if (!depService || depService.status !== 'running') {
          return { 
            success: false, 
            error: `Dependency ${dep.name} is not running` 
          };
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.services.set(serviceName, {
      ...service,
      status: 'running',
      health: {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        failureCount: 0
      },
      metrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        connections: 0
      }
    });

    this.startLogging(service.name);
    this.startMetrics(service.name);
    this.updateDependencyStatuses();

    return { success: true };
  }

  async stopService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isDockerRunning) {
      return { success: false, error: 'Docker is not running' };
    }

    const service = this.services.get(serviceName);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    // Check if any other services depend on this one
    const dependentServices = Array.from(this.services.values())
      .filter(s => s.dependencies?.some(d => d.name === service.name && d.required));

    if (dependentServices.length > 0) {
      return {
        success: false,
        error: `Cannot stop service: required by ${dependentServices.map(s => s.name).join(', ')}`
      };
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.services.set(serviceName, {
      ...service,
      status: 'stopped',
      health: {
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        failureCount: 0
      },
      metrics: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        connections: 0
      }
    });

    this.stopLogging(service.name);
    this.stopMetrics(service.name);
    this.updateDependencyStatuses();

    return { success: true };
  }

  async restartService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    const stopResult = await this.stopService(serviceName);
    if (!stopResult.success) {
      return stopResult;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return this.startService(serviceName);
  }
}

export const dockerMock = new DockerMockService(); 