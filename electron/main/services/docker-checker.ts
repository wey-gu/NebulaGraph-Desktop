import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';

const execAsync = promisify(exec);

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

  constructor() {
    // In development, use the assets directory directly
    // In production, use the extraResources path
    const isDev = process.env.NODE_ENV === 'development';
    const basePath = isDev 
      ? path.join(process.cwd(), 'assets')
      : path.join(app.getPath('userData'), 'resources');

    this.resourcesPath = path.join(basePath, 'NebulaGraph-Desktop');
    this.imagesPath = path.join(this.resourcesPath, 'images');
    this.manifestPath = path.join(this.imagesPath, 'manifest.json');
  }

  async checkDockerSystem(): Promise<DockerSystemStatus> {
    try {
      // Check if Docker CLI is installed
      let dockerVersion: string | undefined;
      let isInstalled = false;
      try {
        const { stdout } = await execAsync('docker --version');
        dockerVersion = stdout.trim();
        isInstalled = true;
      } catch (error) {
        return {
          isInstalled: false,
          isRunning: false,
          error: 'Docker is not installed. Please install Docker Desktop.'
        };
      }

      // Check if Docker daemon is running
      let isRunning = false;
      try {
        await execAsync('docker info');
        isRunning = true;
      } catch (error) {
        return {
          isInstalled: true,
          isRunning: false,
          version: dockerVersion,
          error: 'Docker daemon is not running. Please start Docker Desktop.'
        };
      }

      // Check Docker Compose
      let compose: DockerComposeStatus = { isInstalled: false };
      try {
        const { stdout: composeVersion } = await execAsync('docker compose version');
        compose = {
          isInstalled: true,
          version: composeVersion.trim()
        };
      } catch (error) {
        try {
          const { stdout: legacyVersion } = await execAsync('docker-compose --version');
          compose = {
            isInstalled: true,
            version: legacyVersion.trim()
          };
        } catch (composeError) {
          if (isRunning) {
            return {
              isInstalled: true,
              isRunning: true,
              version: dockerVersion,
              compose: { isInstalled: false },
              error: 'Docker Compose is not installed. Please install Docker Compose v2.'
            };
          }
        }
      }

      return {
        isInstalled,
        isRunning,
        version: dockerVersion,
        compose
      };
    } catch (error) {
      return {
        isInstalled: false,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error checking Docker'
      };
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
          const { stdout } = await execAsync(`docker image inspect ${fullImageName}`);
          console.log(`✓ Image ${fullImageName} exists`);
        } catch (error) {
          console.log(`✕ Image ${fullImageName} not found`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to check images:', error);
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
        console.error('Docker is not ready:', dockerStatus.error);
        return false;
      }

      const manifestContent = await fs.readFile(this.manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      const images = Object.entries<ImageConfig>(manifest.images);
      const total = images.length;

      for (const [index, [key, config]] of images.entries()) {
        const imagePath = path.join(this.imagesPath, `${key}.tar`);
        const fullImageName = `${config.name}:${config.tag}`;

        progressCallback?.(index + 1, total, fullImageName);

        try {
          console.log(`Loading image ${fullImageName}...`);
          await execAsync(`docker load -i "${imagePath}"`);
          console.log(`✓ Loaded ${fullImageName}`);
        } catch (error) {
          console.error(`Failed to load ${fullImageName}:`, error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to load images:', error);
      return false;
    }
  }

  async ensureImagesLoaded(
    progressCallback?: (current: number, total: number, imageName: string) => void
  ): Promise<boolean> {
    // Check Docker system status first
    const dockerStatus = await this.checkDockerSystem();
    if (!dockerStatus.isInstalled || !dockerStatus.isRunning) {
      console.error('Docker is not ready:', dockerStatus.error);
      return false;
    }

    const hasImages = await this.checkRequiredImages();
    if (!hasImages) {
      console.log('Some images are missing, loading from resources...');
      return this.loadImages(progressCallback);
    }
    return true;
  }

  async getResourcesPath(): Promise<string> {
    return this.resourcesPath;
  }
} 