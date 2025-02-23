import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import { logger } from '../utils/logger';

interface ExecResult {
  stdout: string;
  stderr: string;
}

const exec = promisify(execCallback) as (command: string, options?: { env?: NodeJS.ProcessEnv }) => Promise<ExecResult>;

// Common Docker binary locations
const DOCKER_PATHS: Record<NodeJS.Platform, string[]> = {
  darwin: [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker'
  ],
  linux: [
    '/usr/bin/docker',
    '/usr/local/bin/docker'
  ],
  win32: [
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe'
  ],
  aix: [],
  android: [],
  freebsd: [],
  haiku: [],
  openbsd: [],
  sunos: [],
  cygwin: [],
  netbsd: []
};

interface DockerComposeStatus {
  isInstalled: boolean;
  version?: string;
}

interface DockerSystemStatus {
  isInstalled: boolean;
  isRunning: boolean;
  version?: string;
  compose?: DockerComposeStatus;
  error?: string;
}

interface ImageConfig {
  name: string;
  tag: string;
  size?: string;
  checksum?: string;
}

export class DockerChecker {
  private resourcesPath: string;
  private imagesPath: string;
  private manifestPath: string;
  private dockerPath: string | null = null;
  private customEnv: NodeJS.ProcessEnv;

  constructor() {
    // In development, use the assets directory directly
    // In production, use the app's resources path
    const isDev = process.env.NODE_ENV === 'development';
    const basePath = isDev 
      ? path.join(process.cwd(), 'assets')
      : path.join(process.resourcesPath, 'resources');

    this.resourcesPath = path.join(basePath, 'NebulaGraph-Desktop');
    this.imagesPath = path.join(this.resourcesPath, 'images');
    this.manifestPath = path.join(this.imagesPath, 'manifest.json');

    // Initialize environment with additional paths
    this.customEnv = {
      ...process.env,
      PATH: this.getEnhancedPath()
    };

    logger.info('🔧 Environment PATH:', this.customEnv.PATH);
    logger.info('🐳 Docker resources path:', this.resourcesPath);
  }

  private getEnhancedPath(): string {
    const platform = process.platform;
    const currentPath = process.env.PATH || '';
    const additionalPaths = [];

    // Add platform-specific paths
    if (platform === 'darwin') {
      additionalPaths.push(
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/Applications/Docker.app/Contents/Resources/bin',
        '/usr/bin'
      );
    } else if (platform === 'linux') {
      additionalPaths.push(
        '/usr/bin',
        '/usr/local/bin'
      );
    } else if (platform === 'win32') {
      additionalPaths.push(
        'C:\\Program Files\\Docker\\Docker\\resources\\bin',
        'C:\\Program Files\\Docker\\Docker\\resources'
      );
    }

    return [...new Set([...additionalPaths, ...currentPath.split(path.delimiter)])].join(path.delimiter);
  }

  private async findDockerPath(): Promise<string | null> {
    if (this.dockerPath) return this.dockerPath;

    const platform = process.platform;
    const paths = DOCKER_PATHS[platform] || [];

    for (const dockerPath of paths) {
      try {
        await fs.access(dockerPath);
        logger.info('✅ Found Docker binary at:', dockerPath);
        this.dockerPath = dockerPath;
        return dockerPath;
      } catch {
        logger.info('❌ Docker not found at:', dockerPath);
        continue;
      }
    }

    // If we couldn't find Docker in known locations, try PATH
    try {
      const { stdout } = await exec('which docker', { env: this.customEnv });
      const pathFromWhich = stdout.trim();
      if (pathFromWhich) {
        logger.info('✅ Found Docker binary through PATH at:', pathFromWhich);
        this.dockerPath = pathFromWhich;
        return pathFromWhich;
      }
    } catch (error) {
      logger.warn('⚠️ Could not find Docker through PATH');
    }

    return null;
  }

  private getContainerName(serviceName: string): string {
    return `nebulagraph-desktop-${serviceName}-1`;
  }

  async checkDockerSystem(): Promise<DockerSystemStatus> {
    logger.info('🔍 Starting Docker system check...');
    
    try {
      // Check Docker CLI
      logger.info('🐳 Checking Docker CLI...');
      const dockerVersion = await this.execCommand('docker --version');
      logger.info('✓ Docker CLI version:', dockerVersion);

      // Check Docker daemon
      logger.info('🔄 Checking Docker daemon...');
      try {
        const dockerInfo = await this.execCommand('docker info');
        logger.info('✓ Docker daemon is running');
        logger.info('📊 Docker info highlights:', this.parseDockerInfo(dockerInfo));
      } catch (error) {
        logger.error('❌ Docker daemon check failed:', error);
        return {
          isInstalled: true,
          isRunning: false,
          version: dockerVersion,
          error: 'Docker daemon is not running'
        };
      }

      // Check Docker Compose
      logger.info('🔄 Checking Docker Compose...');
      let composeVersion;
      try {
        // Try Docker Compose V2 first
        composeVersion = await this.execCommand('docker compose version');
        logger.info('✓ Docker Compose V2 found:', composeVersion);
      } catch (error) {
        logger.warn('⚠️ Docker Compose V2 not found, trying legacy version...');
        try {
          // Try legacy docker-compose
          composeVersion = await this.execCommand('docker-compose --version');
          logger.info('✓ Legacy Docker Compose found:', composeVersion);
        } catch (composeError) {
          logger.error('❌ No Docker Compose installation found');
          return {
            isInstalled: true,
            isRunning: true,
            version: dockerVersion,
            compose: {
              isInstalled: false,
              version: undefined
            },
            error: 'Docker Compose not found'
          };
        }
      }

      logger.info('✅ All Docker system checks passed');
      return {
        isInstalled: true,
        isRunning: true,
        version: dockerVersion,
        compose: {
          isInstalled: true,
          version: composeVersion
        }
      };
    } catch (error) {
      logger.error('❌ Docker system check failed:', error);
      return {
        isInstalled: false,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error checking Docker system'
      };
    }
  }

  private parseDockerInfo(info: string): object {
    const highlights: any = {};
    const lines = info.split('\n');
    
    for (const line of lines) {
      if (line.includes('Server Version:')) highlights.serverVersion = line.split(':')[1].trim();
      if (line.includes('OS/Arch:')) highlights.osArch = line.split(':')[1].trim();
      if (line.includes('Kernel Version:')) highlights.kernelVersion = line.split(':')[1].trim();
    }
    
    return highlights;
  }

  async execCommand(command: string): Promise<string> {
    try {
      logger.info('🔄 Executing command:', command);
      
      // If command starts with 'docker', try to use full path
      if (command.startsWith('docker ')) {
        const dockerPath = await this.findDockerPath();
        if (dockerPath) {
          command = command.replace('docker ', `"${dockerPath}" `);
        }
      }

      const { stdout, stderr } = await exec(command, { env: this.customEnv });
      if (stderr) {
        logger.warn('⚠️ Command stderr:', stderr);
      }
      return stdout.trim();
    } catch (error) {
      logger.error('❌ Command failed:', command);
      logger.error('Error details:', error);
      throw error;
    }
  }

  async checkDocker(): Promise<DockerSystemStatus> {
    return this.checkDockerSystem();
  }

  async checkRequiredImages(): Promise<boolean> {
    try {
      // Read manifest
      const manifestContent = await fs.readFile(this.manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      // Check each image
      for (const [key, config] of Object.entries<ImageConfig>(manifest.images)) {
        const fullImageName = `${config.name}:${config.tag}`;
        try {
          const { stdout } = await exec(`docker image inspect ${fullImageName}`);
          logger.info(`✓ Image ${fullImageName} exists`);
        } catch (error) {
          logger.error(`✕ Image ${fullImageName} not found`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to check images:', error);
      return false;
    }
  }

  async loadImages(
    progressCallback?: (current: number, total: number, imageName: string) => void
  ): Promise<boolean> {
    try {
      // Check Docker system status first
      const dockerStatus = await this.checkDockerSystem();
      if (!dockerStatus.isInstalled || !dockerStatus.isRunning) {
        logger.info('Docker is not ready:', dockerStatus.error);
        return false;
      }

      logger.info('📦 Starting to load Docker images...');
      const manifestContent = await fs.readFile(this.manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      const images = Object.entries<ImageConfig>(manifest.images);
      const total = images.length;
      logger.info(`Found ${total} images to load`);

      for (const [index, [key, config]] of images.entries()) {
        const imagePath = path.join(this.imagesPath, `${key}.tar`);
        const fullImageName = `${config.name}:${config.tag}`;

        progressCallback?.(index + 1, total, fullImageName);
        logger.info(`[${index + 1}/${total}] Loading image ${fullImageName}...`);
        const startTime = Date.now();

        try {
          logger.info(`Reading image file: ${key}.tar`);
          await exec(`docker load -i "${imagePath}"`);
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          logger.info(`✅ Loaded ${fullImageName} (took ${duration}s)`);
        } catch (error) {
          logger.error(`Failed to load ${fullImageName}:`, error);
          return false;
        }
      }

      logger.info('✅ All images loaded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to load images:', error);
      return false;
    }
  }

  async ensureImagesLoaded(
    progressCallback?: (current: number, total: number, imageName: string) => void
  ): Promise<boolean> {
    // Check Docker system status first
    const dockerStatus = await this.checkDockerSystem();
    if (!dockerStatus.isInstalled || !dockerStatus.isRunning) {
      logger.error('Docker is not ready:', dockerStatus.error);
      return false;
    }

    const hasImages = await this.checkRequiredImages();
    if (!hasImages) {
      logger.info('Some images are missing, loading from resources...');
      return this.loadImages(progressCallback);
    }
    return true;
  }

  async getResourcesPath(): Promise<string> {
    return this.resourcesPath;
  }

  private async getServiceHealth(serviceName: string): Promise<'healthy' | 'unhealthy' | 'starting' | 'unknown'> {
    try {
      const containerName = this.getContainerName(serviceName);
      logger.info(`🏥 Checking health for ${serviceName} (${containerName})`);

      // First try to get container state
      const stateCmd = process.platform === 'win32'
        ? `docker inspect --format "{{if .State}}{{.State.Status}}{{end}}" ${containerName}`
        : `docker inspect --format '{{if .State}}{{.State.Status}}{{end}}' ${containerName}`;

      try {
        const state = await this.execCommand(stateCmd);
        const containerState = state.trim().toLowerCase();
        logger.info(`Container state for ${serviceName}:`, containerState);

        if (containerState === 'running') {
          // If container is running, check health status
          const healthCmd = process.platform === 'win32'
            ? `docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{end}}" ${containerName}`
            : `docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' ${containerName}`;

          const healthStatus = await this.execCommand(healthCmd);
          const status = healthStatus.trim().toLowerCase();
          logger.info(`Health check result for ${serviceName}:`, status);

          if (status === 'healthy') return 'healthy';
          if (status === 'unhealthy') return 'unhealthy';
          if (status === 'starting') return 'starting';

          // For containers without health checks or still initializing
          return 'starting';
        }
      } catch (error) {
        logger.warn(`Container inspection failed for ${serviceName}:`, error);
        // Try fallback to ps command
        try {
          const psCmd = process.platform === 'win32'
            ? `docker ps --filter "name=${containerName}" --format "{{.Status}}"`
            : `docker ps --filter name=${containerName} --format "{{.Status}}"`;

          logger.info('Trying fallback ps command:', psCmd);
          const psStatus = await this.execCommand(psCmd);
          if (psStatus.includes('Up')) {
            return 'starting';
          }
        } catch (psError) {
          logger.error('Fallback ps command also failed:', psError);
        }
      }

      return 'unknown';
    } catch (error) {
      logger.error(`❌ Health check error for ${serviceName}:`, error);
      return 'unknown';
    }
  }
} 