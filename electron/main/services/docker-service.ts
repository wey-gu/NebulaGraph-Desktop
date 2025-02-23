import { exec as execCallback, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { DockerChecker } from './docker-checker';

const exec = promisify(execCallback);

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

// Add cache management
interface ImageCheckCache {
  timestamp: number;
  status: boolean;
}

export class DockerService {
  private composeFilePath: string = '';
  private dataDir: string = '';
  private logsDir: string = '';
  private dockerChecker: DockerChecker;
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
  
  // Add cache properties
  private static imageCheckCache: ImageCheckCache | null = null;
  private static CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  private static servicesStarting: boolean = false;
  private static lastServiceStatus: Record<string, ServiceStatus> = {};

  constructor() {
    this.dockerChecker = new DockerChecker();
    this.initializePaths();
  }

  // Add cache management methods
  private static isImageCheckCacheValid(): boolean {
    if (!DockerService.imageCheckCache) return false;
    const now = Date.now();
    return (now - DockerService.imageCheckCache.timestamp) < DockerService.CACHE_DURATION;
  }

  private static updateImageCheckCache(status: boolean) {
    DockerService.imageCheckCache = {
      timestamp: Date.now(),
      status
    };
  }

  private async initializePaths() {
    const resourcesPath = await this.dockerChecker.getResourcesPath();
    this.composeFilePath = path.join(resourcesPath, 'docker-compose.yml');
    this.dataDir = path.join(resourcesPath, 'data');
    this.logsDir = path.join(resourcesPath, 'logs');
    
    this.ensureDirectories();
    console.log('🐳 Initializing Docker service with compose file:', this.composeFilePath);
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
    const status = await this.dockerChecker.checkDocker();
    if (!status.isInstalled) {
      console.error('Docker is not installed:', status.error);
      return false;
    }
    if (!status.isRunning) {
      console.error('Docker is not running:', status.error);
      return false;
    }
    if (!status.compose?.isInstalled) {
      console.error('Docker Compose is not available:', status.error);
      return false;
    }
    return true;
  }

  async getSystemStatus(): Promise<DockerSystemStatus> {
    return this.dockerChecker.checkDocker();
  }
  private async checkPortAvailability(ports: number[]): Promise<{ available: boolean; conflictingPorts: number[] }> {
    const conflictingPorts: number[] = [];
    
    for (const port of ports) {
      try {
        if (process.platform === 'win32') {
          // Windows command to check port usage
          const { stdout } = await exec(`netstat -ano | findstr :${port}`);
          if (stdout.trim()) {
            conflictingPorts.push(port);
          }
        } else {
          // macOS/Linux command
          const { stdout } = await exec(`lsof -i :${port}`);
          if (stdout.trim()) {
            conflictingPorts.push(port);
          }
        }
      } catch (error) {
        // Port is available if command fails (no process using the port)
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

        // Try HTTP health check as backup on macOS
        if (process.platform === 'darwin') {
          try {
            const { stdout } = await exec(`curl -s -f http://localhost:${config.healthCheckPort}/status`);
            if (stdout.includes('ok') || stdout.includes('healthy')) {
              return true;
            }
          } catch (error) {
            // Ignore HTTP check errors and continue waiting
          }
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
    if (DockerService.servicesStarting) {
      return { success: false, error: 'Services are already starting' };
    }

    try {
      DockerService.servicesStarting = true;
      
      // Quick Docker check without image verification
      const dockerStatus = await this.dockerChecker.checkDocker();
      if (!dockerStatus.isInstalled || !dockerStatus.isRunning || !dockerStatus.compose?.isInstalled) {
        return { 
          success: false, 
          error: 'Docker system requirements not met. Please check Docker installation.' 
        };
      }

      // Use cached image check if valid
      if (!DockerService.isImageCheckCacheValid()) {
        onProgress?.({
          service: 'system',
          attempt: 0,
          maxAttempts: 1,
          state: 'Checking Docker images...'
        });

        const imagesLoaded = await this.dockerChecker.ensureImagesLoaded(
          (current, total, imageName) => {
            onProgress?.({
              service: 'system',
              attempt: current,
              maxAttempts: total,
              state: `Loading image: ${imageName}`
            });
          }
        );

        DockerService.updateImageCheckCache(imagesLoaded);
        
        if (!imagesLoaded) {
          DockerService.servicesStarting = false;
          return { 
            success: false, 
            error: 'Failed to load required Docker images.' 
          };
        }
      }

      // Start services
      const { stdout, stderr } = await exec(`docker compose -f "${this.composeFilePath}" up -d`);
      
      // Initial delay reduced to 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Parallel health checks with reduced timeout
      const services = Object.keys(this.serviceConfigs);
      const maxRetries = 20; // 20 * 1 second = 20 seconds total timeout
      let retries = 0;
      
      while (retries < maxRetries) {
        const currentStatus = await this.getServicesStatus();
        const allHealthy = Object.values(currentStatus).every(
          status => status.status === 'running' && status.health.status === 'healthy'
        );
        
        if (allHealthy) {
          DockerService.servicesStarting = false;
          return { success: true };
        }

        onProgress?.({
          service: 'system',
          attempt: retries + 1,
          maxAttempts: maxRetries,
          state: 'Waiting for services to be healthy...'
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }

      DockerService.servicesStarting = false;
      const finalStatus = await this.getServicesStatus();
      const unhealthyServices = Object.entries(finalStatus)
        .filter(([_, status]) => status.status !== 'running' || status.health.status !== 'healthy')
        .map(([name, _]) => name);

      return {
        success: unhealthyServices.length === 0,
        error: unhealthyServices.length > 0 
          ? `Services ${unhealthyServices.join(', ')} failed to start properly.`
          : undefined
      };
    } catch (error) {
      DockerService.servicesStarting = false;
      console.error('Failed to start services:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start services.' 
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
      const command = `docker ps --filter "name=${this.getContainerName(serviceName)}" --format "{{.Status}}"`;
      console.log(`🏥 Checking health for ${serviceName} with command:`, command);
      
      const { stdout: healthStatus } = await exec(command);
      const status = healthStatus.trim().toLowerCase();
      console.log(`🏥 Raw health status for ${serviceName}:`, healthStatus);
      console.log(`🏥 Processed status for ${serviceName}:`, status);

      if (status.includes('(healthy)')) {
        console.log(`✅ ${serviceName} is healthy`);
        return 'healthy';
      }
      if (status.includes('(unhealthy)')) {
        console.log(`❌ ${serviceName} is unhealthy`);
        return 'unhealthy';
      }
      if (status.includes('starting')) {
        console.log(`🔄 ${serviceName} is starting`);
        return 'starting';
      }
      
      // If container is running but no health status, try HTTP health check
      if (status.includes('up')) {
        console.log(`⚡ ${serviceName} is up, trying HTTP health check`);
        try {
          const healthCheckPort = this.getHealthCheckPort(serviceName);
          if (!healthCheckPort) {
            console.log(`❌ No health check port for ${serviceName}`);
            return 'unknown';
          }

          const healthCommand = `curl -s -f http://localhost:${healthCheckPort}/status`;
          console.log(`🔍 HTTP health check command:`, healthCommand);
          
          const { stdout } = await exec(healthCommand);
          console.log(`🔍 HTTP health check response:`, stdout);
          
          if (stdout.includes('ok') || stdout.includes('healthy')) {
            console.log(`✅ HTTP health check passed for ${serviceName}`);
            return 'healthy';
          }
          console.log(`❌ HTTP health check failed for ${serviceName}`);
          return 'unhealthy';
        } catch (error) {
          console.log(`⏳ HTTP health check error for ${serviceName}, considering as starting:`, error);
          return 'starting';
        }
      }

      console.log(`❓ Unknown status for ${serviceName}`);
      return 'unknown';
    } catch (error) {
      console.error(`❌ Health check error for ${serviceName}:`, error);
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
    // Return cached status if services are still starting
    if (DockerService.servicesStarting && Object.keys(DockerService.lastServiceStatus).length > 0) {
      console.log('🔄 Returning cached status while services are starting:', DockerService.lastServiceStatus);
      return DockerService.lastServiceStatus;
    }

    try {
      const services: Record<string, ServiceStatus> = {};
      const statusPromises = Object.entries(this.serviceConfigs).map(async ([serviceName, config]) => {
        try {
          const containerName = this.getContainerName(serviceName);
          console.log(`📋 Checking status for ${serviceName} (${containerName})`);
          
          const { stdout: inspectOutput } = await exec(`docker inspect ${containerName} || echo "not-found"`);
          console.log(`🔍 Inspect output for ${serviceName}:`, inspectOutput.substring(0, 100) + '...');
          
          if (inspectOutput === "not-found") {
            console.log(`❌ Container not found for ${serviceName}`);
            services[serviceName] = {
              name: config.name,
              status: 'stopped',
              health: {
                status: 'unknown',
                lastCheck: new Date().toISOString(),
                failureCount: 0
              },
              metrics: null,
              ports: config.ports,
              logs: []
            };
            return;
          }

          const inspectData = JSON.parse(inspectOutput)[0];
          const isRunning = inspectData?.State?.Running === true;
          console.log(`⚡ Container running state for ${serviceName}:`, isRunning);
          
          const health = await this.getServiceHealth(serviceName);
          console.log(`💚 Health status for ${serviceName}:`, health);

          if (isRunning) {
            // Get metrics in parallel
            const metricsPromise = exec(
              `docker stats ${containerName} --no-stream --format "{{.CPUPerc}};{{.MemUsage}};{{.NetIO}}"`
            ).catch(() => ({ stdout: '0%;0MB;0B' }));

            const { stdout: statsOutput } = await metricsPromise;
            const [cpu, mem, net] = statsOutput.split(';');
            console.log(`📊 Metrics for ${serviceName}:`, { cpu, mem, net });
            
            services[serviceName] = {
              name: config.name,
              status: 'running',
              health: {
                status: health,
                lastCheck: new Date().toISOString(),
                failureCount: health === 'unhealthy' ? 1 : 0
              },
              metrics: {
                cpu: cpu?.replace('%', '') || '0',
                memory: mem?.split('/')[0].trim() || '0',
                network: net || '0'
              },
              ports: config.ports,
              logs: []
            };
          } else {
            console.log(`⏹️ Service ${serviceName} is not running`);
            services[serviceName] = {
              name: config.name,
              status: 'stopped',
              health: {
                status: 'unknown',
                lastCheck: new Date().toISOString(),
                failureCount: 0
              },
              metrics: null,
              ports: config.ports,
              logs: []
            };
          }
        } catch (error) {
          console.error(`❌ Error getting status for ${serviceName}:`, error);
          services[serviceName] = {
            name: config.name,
            status: 'error',
            health: {
              status: 'unknown',
              lastCheck: new Date().toISOString(),
              failureCount: 1
            },
            metrics: null,
            ports: config.ports,
            logs: []
          };
        }
      });

      await Promise.all(statusPromises);
      console.log('✅ Final services status:', services);
      DockerService.lastServiceStatus = services;
      return services;
    } catch (error) {
      console.error('❌ Error getting services status:', error);
      return DockerService.lastServiceStatus;
    }
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