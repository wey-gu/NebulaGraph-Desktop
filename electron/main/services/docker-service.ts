import { exec as execCallback, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DockerChecker } from './docker-checker';
import { app } from 'electron';
import { logger } from '../utils/logger';

const exec = promisify(execCallback) as (command: string, options?: { env?: NodeJS.ProcessEnv }) => Promise<{ stdout: string; stderr: string }>;

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

  private static composeFileCache: {
    path: string;
    lastCheck: number;
    exists: boolean;
  } | null = null;
  private static COMPOSE_CACHE_DURATION = 1000 * 60; // 1 minute

  constructor() {
    logger.info('🚀 Initializing Docker Service...');
    this.dockerChecker = new DockerChecker();
    this.initializePaths(true).catch(error => {
      logger.error('Failed to initialize paths:', error);
    });
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

  private async verifyComposeFile(): Promise<boolean> {
    const now = Date.now();
    
    // Use cache if available and recent
    if (DockerService.composeFileCache && 
        DockerService.composeFileCache.path === this.composeFilePath &&
        (now - DockerService.composeFileCache.lastCheck) < DockerService.COMPOSE_CACHE_DURATION) {
      return DockerService.composeFileCache.exists;
    }

    try {
      await fs.access(this.composeFilePath);
      const content = await fs.readFile(this.composeFilePath, 'utf8');
      const isValid = content.includes(this.dataDir.replace(/\\/g, '/'));
      
      // Update cache
      DockerService.composeFileCache = {
        path: this.composeFilePath,
        lastCheck: now,
        exists: isValid
      };
      
      return isValid;
    } catch {
      DockerService.composeFileCache = {
        path: this.composeFilePath,
        lastCheck: now,
        exists: false
      };
      return false;
    }
  }

  public async initializePaths(force: boolean = false) {
    const userDataPath = app.getPath('userData');
    this.dataDir = path.join(userDataPath, '.nebulagraph-desktop');
    this.logsDir = path.join(this.dataDir, 'logs');
    this.composeFilePath = path.join(this.dataDir, 'docker-compose.yml');

    // Only log paths if forced or first time
    if (force) {
      logger.info('📂 Setting up service paths...');
      logger.info('📁 Data directory:', this.dataDir);
      logger.info('📁 Logs directory:', this.logsDir);
      logger.info('📄 Compose file:', this.composeFilePath);
    }

    await this.ensureDirectories();
    
    // Check if we need to set up compose file
    const composeExists = await this.verifyComposeFile();
    if (!composeExists) {
      await this.setupComposeFile();
    }
  }

  private async setupComposeFile() {
    logger.info('🔧 Setting up docker-compose.yml...');
    try {
      // Get the template compose file from resources
      const resourcesPath = await this.dockerChecker.getResourcesPath();
      const templateComposePath = path.join(resourcesPath, 'docker-compose.yml');
      logger.info('📄 Template compose path:', templateComposePath);

      // Check if template exists
      try {
        await fs.access(templateComposePath);
      } catch (error) {
        logger.error('❌ Template compose file not found at:', templateComposePath);
        throw new Error('Template compose file not found');
      }

      // Read template content
      logger.info('📝 Creating new compose file...');
      const templateContent = await fs.readFile(templateComposePath, 'utf8');
      
      // Replace paths with absolute paths, ensuring forward slashes for Docker
      const dataPath = this.dataDir.replace(/\\/g, '/');
      const logsPath = this.logsDir.replace(/\\/g, '/');
      
      const updatedContent = templateContent
        .replace(/\.\/(data|logs)/g, (_, dir) => dir === 'data' ? dataPath : logsPath)
        .replace(/\${PWD}\/(data|logs)/g, (_, dir) => dir === 'data' ? dataPath : logsPath);
      
      // Write the updated compose file
      await fs.writeFile(this.composeFilePath, updatedContent);
      
      // Update cache
      DockerService.composeFileCache = {
        path: this.composeFilePath,
        lastCheck: Date.now(),
        exists: true
      };
      
      logger.info('✅ Compose file created successfully');
    } catch (error) {
      logger.error('❌ Failed to setup compose file:', error);
      throw error;
    }
  }

  private async ensureDirectories() {
    logger.info('🔧 Ensuring directories exist...');
    const dirs = [
      path.join(this.dataDir, 'meta'),
      path.join(this.dataDir, 'storage'),
      path.join(this.logsDir, 'meta'),
      path.join(this.logsDir, 'storage'),
      path.join(this.logsDir, 'graph')
    ];

    try {
      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
        logger.info('✅ Created directory:', dir);
      }
      logger.info('✅ All directories created successfully');
    } catch (error) {
      logger.error('❌ Failed to create directories:', error);
      throw error;
    }
  }

  async checkDockerStatus(): Promise<boolean> {
    logger.info('🔍 Checking Docker status...');
    try {
      const status = await this.dockerChecker.checkDockerSystem();
      logger.info('Docker status:', status);
      return status.isInstalled && status.isRunning;
    } catch (error) {
      logger.error('❌ Docker status check failed:', error);
      return false;
    }
  }

  async getSystemStatus(): Promise<DockerSystemStatus> {
    console.log('🔍 Getting Docker system status...');
    const status = await this.dockerChecker.checkDocker();
    console.log('📋 Docker system status:', status);
    return status;
  }

  private async checkPortAvailability(ports: number[]): Promise<{ available: boolean; conflictingPorts: number[] }> {
    const conflictingPorts: number[] = [];
    
    for (const port of ports) {
      try {
        if (process.platform === 'win32') {
          // Windows command to check port usage
          const output = await this.dockerChecker.execCommand(`netstat -ano | findstr :${port}`);
          if (output.trim()) {
            conflictingPorts.push(port);
          }
        } else {
          // macOS/Linux command
          const output = await this.dockerChecker.execCommand(`lsof -i :${port}`);
          if (output.trim()) {
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
            const output = await this.dockerChecker.execCommand(`curl -s -f http://localhost:${config.healthCheckPort}/status`);
            if (output.includes('ok') || output.includes('healthy')) {
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
    logger.info('🚀 Starting NebulaGraph services...');
    
    try {
      // Ensure directories are initialized first
      await this.initializePaths();
      
      // Check Docker status first
      const isDockerRunning = await this.checkDockerStatus();
      if (!isDockerRunning) {
        const error = 'Docker is not running. Please start Docker Desktop first.';
        logger.error(error);
        return { success: false, error };
      }

      // Execute docker compose up
      logger.info('📦 Running docker compose up...');
      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose up -d`;
      try {
        await this.dockerChecker.execCommand(command);
        logger.info('✅ Services started successfully');
      } catch (error) {
        logger.error('❌ Failed to start services:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to start services' };
      }

      // Wait for services to be healthy
      logger.info('🔄 Waiting for services to be healthy...');
      for (const [serviceName, config] of Object.entries(this.serviceConfigs)) {
        const isHealthy = await this.waitForHealthCheck(
          serviceName,
          60,
          2000,
          onProgress
        );
        if (!isHealthy) {
          const error = `Service ${serviceName} failed to become healthy`;
          logger.error(error);
          return { success: false, error };
        }
      }

      logger.info('✅ All services are healthy');
      return { success: true };
    } catch (error) {
      logger.error('❌ Failed to start services:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error starting services'
      };
    }
  }

  async stopServices(): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure directories are initialized first
      await this.initializePaths();

      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose stop`;
      try {
        await this.dockerChecker.execCommand(command);
        return { success: true };
      } catch (error) {
        logger.error('Failed to stop services:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to stop services' 
        };
      }
    } catch (error) {
      logger.error('Failed to stop services:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop services' 
      };
    }
  }

  async cleanupServices(): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure directories are initialized first
      await this.initializePaths();

      if (!await this.checkDockerStatus()) {
        return { success: false, error: 'Docker is not running' };
      }

      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose down`;
      try {
        await this.dockerChecker.execCommand(command);
        return { success: true };
      } catch (error) {
        logger.error('Failed to cleanup services:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to cleanup services' 
        };
      }
    } catch (error) {
      logger.error('Failed to cleanup services:', error);
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
      // Get detailed container status
      const containerName = this.getContainerName(serviceName);
      const healthCommand = `docker inspect --format '{{.State.Health.Status}}' ${containerName} 2>/dev/null || echo "none"`;
      logger.info(`🏥 Checking health for ${serviceName} with command:`, healthCommand);
      
      const healthStatus = await this.dockerChecker.execCommand(healthCommand);
      const status = healthStatus.trim().toLowerCase();
      logger.info(`🏥 Health status for ${serviceName}:`, status);

      // Map Docker health status to our status
      switch (status) {
        case 'healthy':
          return 'healthy';
        case 'unhealthy':
          return 'unhealthy';
        case 'starting':
        case 'none':
          // If no health status, check if container is running
          const stateCommand = `docker inspect --format '{{.State.Status}}' ${containerName} 2>/dev/null || echo "none"`;
          const state = await this.dockerChecker.execCommand(stateCommand);
          const containerState = state.trim().toLowerCase();
          
          if (containerState === 'running') {
            // For containers without health checks (like storage-activator)
            if (serviceName === 'storage-activator') {
              return 'healthy';
            }
            // Container is running but still initializing
            return 'starting';
          }
          return 'unknown';
        default:
          return 'unknown';
      }
    } catch (error) {
      logger.error(`❌ Health check error for ${serviceName}:`, error);
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
    try {
      // Ensure directories are initialized first
      await this.initializePaths();
      
      // Return cached status if services are still starting
      if (DockerService.servicesStarting && Object.keys(DockerService.lastServiceStatus).length > 0) {
        logger.info('🔄 Returning cached status while services are starting:', DockerService.lastServiceStatus);
        return DockerService.lastServiceStatus;
      }

      const services: Record<string, ServiceStatus> = {};
      const statusPromises = Object.entries(this.serviceConfigs).map(async ([serviceName, config]) => {
        try {
          const containerName = this.getContainerName(serviceName);
          logger.info(`📋 Checking status for ${serviceName} (${containerName})`);
          
          const inspectCommand = `docker inspect ${containerName} || echo "not-found"`;
          const inspectOutput = await this.dockerChecker.execCommand(inspectCommand);
          logger.info(`🔍 Inspect output for ${serviceName}:`, inspectOutput.substring(0, 100) + '...');
          
          if (inspectOutput === "not-found") {
            logger.info(`❌ Container not found for ${serviceName}`);
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
          logger.info(`⚡ Container running state for ${serviceName}:`, isRunning);
          
          const health = await this.getServiceHealth(serviceName);
          logger.info(`💚 Health status for ${serviceName}:`, health);

          if (isRunning) {
            // Get metrics in parallel
            const statsCommand = `docker stats ${containerName} --no-stream --format "{{.CPUPerc}};{{.MemUsage}};{{.NetIO}}"`;
            const statsOutput = await this.dockerChecker.execCommand(statsCommand).catch(() => '0%;0MB;0B');
            const [cpu, mem, net] = statsOutput.split(';');
            logger.info(`📊 Metrics for ${serviceName}:`, { cpu, mem, net });

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
            logger.info(`⏹️ Service ${serviceName} is not running`);
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
          logger.error(`❌ Error getting status for ${serviceName}:`, error);
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
      logger.info('✅ Final services status:', services);
      DockerService.lastServiceStatus = services;
      return services;
    } catch (error) {
      logger.error('❌ Error getting services status:', error);
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
      // Ensure directories are initialized first
      await this.initializePaths();

      if (!await this.checkDockerStatus()) {
        return [];
      }

      logger.info('getServiceLogs input serviceName:', serviceName);

      // Find the service config entry by display name
      const serviceEntry = Object.entries(this.serviceConfigs).find(([_, config]) => 
        config.displayName === serviceName || // Try display name first
        config.name === serviceName || // Then try exact service name match
        config.displayName.toLowerCase() === serviceName.toLowerCase() // Finally try case-insensitive display name
      );

      if (!serviceEntry) {
        logger.error('Service entry not found for:', serviceName);
        logger.info('Available services:', Object.entries(this.serviceConfigs).map(([key, config]) => ({
          key,
          name: config.name,
          displayName: config.displayName
        })));
        return [];
      }

      const [_, config] = serviceEntry;
      logger.info('Found service config:', {
        inputName: serviceName,
        dockerServiceName: config.name,
        displayName: config.displayName
      });
      
      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose logs --no-color --tail=100 ${config.name}`;
      logger.info('Executing command:', command);

      const output = await this.dockerChecker.execCommand(command);

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => ({
          timestamp: new Date().toISOString(),
          message: line,
          level: line.toLowerCase().includes('error') ? 'error' : 
                 line.toLowerCase().includes('warn') ? 'warn' : 'info'
        }));
    } catch (error) {
      logger.error(`Failed to get logs for service ${serviceName}:`, error);
      return [];
    }
  }

  async startService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure directories are initialized first
      await this.initializePaths();

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
      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose up -d ${dockerServiceName}`;
      try {
        await this.dockerChecker.execCommand(command);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : `Failed to start ${serviceName}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : `Failed to start ${serviceName}` 
      };
    }
  }

  async stopService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure directories are initialized first
      await this.initializePaths();

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
      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose stop ${dockerServiceName}`;
      try {
        await this.dockerChecker.execCommand(command);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : `Failed to stop ${serviceName}` 
        };
      }
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
      // Ensure directories are initialized first
      await this.initializePaths();

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
      const command = `cd "${path.dirname(this.composeFilePath)}" && docker compose restart ${dockerServiceName}`;
      try {
        await this.dockerChecker.execCommand(command);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : `Failed to restart ${serviceName}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : `Failed to restart ${serviceName}` 
      };
    }
  }
}