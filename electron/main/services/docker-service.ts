import { exec as execCallback, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const exec = promisify(execCallback);

interface ServiceStatus {
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

interface ServiceConfig {
  name: string;
  displayName: string;
  ports: string[];
  healthCheckPort: number;
  requiredPorts: number[];
  dependencies: string[];
}

export class DockerService {
  private composeFilePath: string;
  private dataDir: string;
  private logsDir: string;
  private serviceConfigs: Record<string, ServiceConfig> = {
    metad: {
      name: 'metad',
      displayName: 'Meta Service',
      ports: ['9559', '19559', '11000'],
      healthCheckPort: 11000,
      requiredPorts: [9559, 19559, 11000],
      dependencies: []
    },
    storaged: {
      name: 'storaged',
      displayName: 'Storage Service',
      ports: ['9779', '19779', '12000'],
      healthCheckPort: 12000,
      requiredPorts: [9779, 19779, 12000],
      dependencies: ['metad']
    },
    graphd: {
      name: 'graphd',
      displayName: 'Graph Service',
      ports: ['9669', '19669', '13000'],
      healthCheckPort: 13000,
      requiredPorts: [9669, 19669, 13000],
      dependencies: ['metad', 'storaged']
    },
    studio: {
      name: 'studio',
      displayName: 'Studio',
      ports: ['7001'],
      healthCheckPort: 7001,
      requiredPorts: [7001],
      dependencies: ['graphd']
    }
  };

  constructor() {
    const assetsDir = path.join(process.cwd(), 'assets', 'NebulaGraph-Desktop');
    this.composeFilePath = path.join(assetsDir, 'docker-compose.yml');
    this.dataDir = path.join(assetsDir, 'data');
    this.logsDir = path.join(assetsDir, 'logs');
    
    this.ensureDirectories();
    console.log('🐳 Initializing Docker service with compose file:', this.composeFilePath);

    // Initialize default services
    this.serviceConfigs = {
      metad: {
        name: 'metad',
        displayName: 'Meta Service',
        ports: ['9559', '19559', '19560'],
        healthCheckPort: 19559,
        requiredPorts: [9559, 19559, 19560],
        dependencies: []
      },
      storaged: {
        name: 'storaged',
        displayName: 'Storage Service',
        ports: ['9779', '19779', '19780'],
        healthCheckPort: 19779,
        requiredPorts: [9779, 19779, 19780],
        dependencies: ['metad']
      },
      graphd: {
        name: 'graphd',
        displayName: 'Graph Service',
        ports: ['9669', '19669', '19670'],
        healthCheckPort: 19669,
        requiredPorts: [9669, 19669, 19670],
        dependencies: ['storaged']
      },
      studio: {
        name: 'studio',
        displayName: 'Studio',
        ports: ['7001'],
        healthCheckPort: 7001,
        requiredPorts: [7001],
        dependencies: ['graphd']
      }
    };
  }

  private ensureDirectories() {
    const dirs = [
      path.join(this.dataDir, 'meta'),
      path.join(this.dataDir, 'storage'),
      path.join(this.logsDir, 'meta'),
      path.join(this.logsDir, 'storage'),
      path.join(this.logsDir, 'graph')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async checkDockerStatus(): Promise<boolean> {
    try {
      await exec('docker info');
      return true;
    } catch (error) {
      console.error('Docker is not running:', error);
      return false;
    }
  }

  private async checkPortAvailability(ports: number[]): Promise<{ available: boolean; conflictingPorts: number[] }> {
    const conflictingPorts: number[] = [];
    
    for (const port of ports) {
      try {
        const { stdout } = await exec(`lsof -i :${port}`);
        if (stdout.trim()) {
          conflictingPorts.push(port);
        }
      } catch (error) {
        // Port is available if lsof command fails (no process using the port)
        continue;
      }
    }

    return {
      available: conflictingPorts.length === 0,
      conflictingPorts
    };
  }

  private async waitForHealthCheck(
    service: string, 
    maxAttempts = 60, // Increased from 30 to 60 attempts
    interval = 2000,
    onProgress?: (status: { service: string; attempt: number; maxAttempts: number; state: string }) => void
  ): Promise<boolean> {
    const config = this.serviceConfigs[service];
    if (!config) return false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // First check Docker health status
        const health = await this.getServiceHealth(service);
        
        // Report progress
        onProgress?.({
          service,
          attempt,
          maxAttempts,
          state: health
        });

        // If the service is healthy, we're done
        if (health === 'healthy') {
          return true;
        }

        // If the service is still starting, continue waiting
        if (health === 'starting') {
          await new Promise(resolve => setTimeout(resolve, interval));
          continue;
        }

        // Try HTTP health check as backup
        try {
          const { stdout } = await exec(`curl -s -f http://localhost:${config.healthCheckPort}/status`);
          if (stdout.includes('ok') || stdout.includes('healthy')) {
            return true;
          }
        } catch (error) {
          // Ignore HTTP check errors and continue waiting
        }
      } catch (error) {
        // Ignore errors and continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // If we get here, check one last time if the service is at least running
    const health = await this.getServiceHealth(service);
    return health === 'starting' || health === 'healthy';
  }

  async startServices(
    onProgress?: (status: { service: string; attempt: number; maxAttempts: number; state: string }) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      // Check all required ports
      const allPorts = Object.values(this.serviceConfigs).flatMap(config => config.requiredPorts);
      const { available, conflictingPorts } = await this.checkPortAvailability(allPorts);
      
      if (!available) {
        return { 
          success: false, 
          error: `Ports ${conflictingPorts.join(', ')} are already in use` 
        };
      }

      const { stdout, stderr } = await exec(`docker compose -f "${this.composeFilePath}" up -d`);
      console.log('Docker Compose up output:', stdout);
      
      if (stderr) {
        console.warn('Docker Compose up warnings:', stderr);
      }

      // Wait for all services to be healthy
      const services = Object.keys(this.serviceConfigs);
      let allHealthy = true;
      let unhealthyServices: string[] = [];

      for (const service of services) {
        const healthy = await this.waitForHealthCheck(
          service,
          60, // 2 minutes timeout (with 2s interval)
          2000,
          onProgress
        );

        if (!healthy) {
          unhealthyServices.push(this.serviceConfigs[service].name);
          allHealthy = false;
        }
      }

      // If some services are not fully healthy but at least starting, return success
      if (!allHealthy) {
        const servicesStatus = await this.getServicesStatus();
        const anyStillStarting = Object.values(servicesStatus).some(
          s => s.status === 'running' && s.health === 'starting'
        );

        if (anyStillStarting) {
          return { 
            success: true,
            error: 'Some services are still initializing but will be ready soon'
          };
        }

        return {
          success: false,
          error: `Services ${unhealthyServices.join(', ')} failed to start properly`
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to start services:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start services' 
      };
    }
  }

  async stopServices(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      const { stdout, stderr } = await exec(`docker compose -f "${this.composeFilePath}" stop`);
      console.log('Docker Compose stop output:', stdout);
      
      if (stderr) {
        console.warn('Docker Compose stop warnings:', stderr);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to stop services:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop services' 
      };
    }
  }

  async cleanupServices(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      const { stdout, stderr } = await exec(`docker compose -f "${this.composeFilePath}" down`);
      console.log('Docker Compose down output:', stdout);
      
      if (stderr) {
        console.warn('Docker Compose down warnings:', stderr);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to cleanup services:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cleanup services' 
      };
    }
  }

  private getContainerName(serviceName: string): string {
    return `nebulagraph-desktop-${serviceName}-1`;
  }

  private async getServiceHealth(serviceName: string): Promise<'healthy' | 'unhealthy' | 'starting' | 'unknown'> {
    try {
      // First check Docker health status
      const { stdout: healthStatus } = await exec(
        `docker ps --filter "name=${this.getContainerName(serviceName)}" --format "{{.Status}}"`
      );

      if (healthStatus.includes('(healthy)')) return 'healthy';
      if (healthStatus.includes('(unhealthy)')) return 'unhealthy';
      if (healthStatus.includes('starting')) return 'starting';
      if (healthStatus.includes('Up')) return 'starting'; // Consider "Up" state as starting

      // If no health status from Docker, try HTTP health check
      const { stdout: containerInfo } = await exec(
        `docker inspect ${this.getContainerName(serviceName)}`
      );
      
      const container = JSON.parse(containerInfo)[0];
      
      if (!container || !container.State.Running) {
        return 'unknown';
      }

      // Get container IP
      const networks = container.NetworkSettings.Networks;
      const ip = networks['nebulagraph-desktop_nebula-net']?.IPAddress || 
                 networks['docker_nebula-net']?.IPAddress;
      if (!ip) return 'unknown';

      // Try HTTP health check
      try {
        const healthCheckPort = this.getHealthCheckPort(serviceName);
        if (!healthCheckPort) return 'unknown';

        const { stdout: curlResult } = await exec(
          `curl -s -o /dev/null -w "%{http_code}" http://${ip}:${healthCheckPort}/status`
        );

        return curlResult === '200' ? 'healthy' : 'unhealthy';
      } catch (error) {
        return 'unhealthy';
      }
    } catch (error) {
      console.error(`Health check error for ${serviceName}:`, error);
      return 'unknown';
    }
  }

  private getHealthCheckPort(serviceName: string): number | null {
    switch (serviceName) {
      case 'metad':
        return 11000;
      case 'storaged':
        return 12000;
      case 'graphd':
        return 13000;
      case 'studio':
        return 7001;
      default:
        return null;
    }
  }

  async getServicesStatus(): Promise<Record<string, ServiceStatus>> {
    const services: Record<string, ServiceStatus> = {};

    for (const [serviceName, config] of Object.entries(this.serviceConfigs)) {
      try {
        // Check if container exists and is running
        const { stdout: inspectOutput } = await exec(
          `docker inspect ${this.getContainerName(serviceName)}`
        );
        
        const inspectData = JSON.parse(inspectOutput)[0];
        const isRunning = inspectData?.State?.Running === true;
        const health = await this.getServiceHealth(serviceName);

        // Get container metrics
        let metrics = null;
        if (isRunning) {
          const { stdout: statsOutput } = await exec(
            `docker stats ${this.getContainerName(serviceName)} --no-stream --format "{{.CPUPerc}};{{.MemUsage}};{{.NetIO}}"`
          );
          
          const [cpu, mem, net] = statsOutput.split(';');
          metrics = {
            cpu: cpu?.replace('%', '') || '0',
            memory: mem?.split('/')[0].trim() || '0',
            network: net || '0'
          };
        }

        services[serviceName] = {
          name: config.name,
          status: isRunning ? 'running' as const : 'stopped' as const,
          health,
          metrics,
          ports: config.ports,
          logs: []
        };
      } catch (error) {
        console.error(`Error getting status for ${serviceName}:`, error);
        services[serviceName] = {
          name: config.name,
          status: 'error' as const,
          health: 'unknown',
          metrics: null,
          ports: config.ports,
          logs: []
        };
      }
    }

    return services;
  }

  private convertToMB(value: number, unit: string): number {
    switch (unit.toLowerCase()) {
      case 'b': return value / (1024 * 1024);
      case 'kb': return value / 1024;
      case 'mb': return value;
      case 'gb': return value * 1024;
      case 'tb': return value * 1024 * 1024;
      default: return value;
    }
  }

  async getServiceLogs(serviceName: string): Promise<Array<{ timestamp: string; message: string; level: string }>> {
    try {
      if (!await this.checkDockerStatus()) {
        return [];
      }

      console.log('getServiceLogs input serviceName:', serviceName);

      // Find the service config entry by display name
      const serviceEntry = Object.entries(this.serviceConfigs).find(([_, config]) => 
        config.displayName === serviceName || // Try display name first
        config.name === serviceName || // Then try exact service name match
        config.displayName.toLowerCase() === serviceName.toLowerCase() // Finally try case-insensitive display name
      );

      if (!serviceEntry) {
        console.error('Service entry not found for:', serviceName);
        console.log('Available services:', Object.entries(this.serviceConfigs).map(([key, config]) => ({
          key,
          name: config.name,
          displayName: config.displayName
        })));
        return [];
      }

      const [_, config] = serviceEntry;
      console.log('Found service config:', {
        inputName: serviceName,
        dockerServiceName: config.name,
        displayName: config.displayName
      });
      
      const command = `docker compose -f "${this.composeFilePath}" logs --no-color --tail=100 ${config.name}`;
      console.log('Executing command:', command);

      const { stdout } = await exec(command);

      return stdout.split('\n')
        .filter(line => line.trim())
        .map(line => ({
          timestamp: new Date().toISOString(),
          message: line,
          level: line.toLowerCase().includes('error') ? 'error' : 
                 line.toLowerCase().includes('warn') ? 'warn' : 'info'
        }));
    } catch (error) {
      console.error(`Failed to get logs for service ${serviceName}:`, error);
      return [];
    }
  }

  async startService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      // Find the service config entry
      const serviceEntry = Object.entries(this.serviceConfigs).find(([_, config]) => config.name === serviceName);
      if (!serviceEntry) {
        return { 
          success: false, 
          error: `Service not found: ${serviceName}` 
        };
      }

      const [dockerServiceName] = serviceEntry;
      const { stdout, stderr } = await exec(
        `docker compose -f "${this.composeFilePath}" up -d ${dockerServiceName}`
      );
      
      if (stderr && !stderr.includes('Creating') && !stderr.includes('Starting')) {
        return { 
          success: false, 
          error: stderr 
        };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : `Failed to start ${serviceName}` 
      };
    }
  }

  async stopService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      // Find the service config entry
      const serviceEntry = Object.entries(this.serviceConfigs).find(([_, config]) => config.name === serviceName);
      if (!serviceEntry) {
        return { 
          success: false, 
          error: `Service not found: ${serviceName}` 
        };
      }

      const [dockerServiceName] = serviceEntry;
      const { stdout, stderr } = await exec(
        `docker compose -f "${this.composeFilePath}" stop ${dockerServiceName}`
      );
      
      if (stderr && !stderr.includes('Stopping')) {
        return { 
          success: false, 
          error: stderr 
        };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : `Failed to stop ${serviceName}` 
      };
    }
  }

  private mapContainerState(state: string): 'running' | 'stopped' | 'error' {
    switch (state.toLowerCase()) {
      case 'running':
        return 'running';
      case 'exited':
      case 'stopped':
        return 'stopped';
      default:
        return 'error';
    }
  }

  private getServiceName(displayName: string): string {
    // This is now used only for docker compose commands
    return displayName.toLowerCase();
  }

  async restartService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      // Find the service config entry
      const serviceEntry = Object.entries(this.serviceConfigs).find(([_, config]) => config.name === serviceName);
      if (!serviceEntry) {
        return { 
          success: false, 
          error: `Service not found: ${serviceName}` 
        };
      }

      const [dockerServiceName] = serviceEntry;
      const { stdout, stderr } = await exec(
        `docker compose -f "${this.composeFilePath}" restart ${dockerServiceName}`
      );
      
      if (stderr && !stderr.includes('Restarting')) {
        return { 
          success: false, 
          error: stderr 
        };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : `Failed to restart ${serviceName}` 
      };
    }
  }
}