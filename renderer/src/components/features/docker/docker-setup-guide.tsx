"use client"

import { FeatureSteps } from "@/components/blocks/feature-section"
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const dockerSetupFeatures = [
  {
    step: 'Step 1',
    title: 'Docker Desktop Installed',
    content: 'Download and install the latest version of Docker Desktop from docker.com. This will provide you with Docker Engine and Docker Compose v2 for container management.',
    image: './docker-desktop.png'
  },
  {
    step: 'Step 2', 
    title: 'Docker Desktop Running',
    content: 'Start Docker Desktop and verify it is running properly. You should see the Docker whale icon in your system tray indicating the engine is active.',
    image: './docker-running.png'
  },
  {
    step: 'Step 3',
    title: 'Compose v2 Installed',
    content: 'Open a terminal and run these commands to verify the installation: "docker --version" to check Docker CLI and "docker compose version" to confirm Docker Compose v2 is installed correctly.',
    image: './docker-verify.png'
  }
]

interface Log {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

interface DockerSetupGuideProps {
  onComplete?: () => void
  className?: string
}

export function DockerSetupGuide({ onComplete, className }: DockerSetupGuideProps) {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    // Subscribe to logs from the main process
    const unsubscribe = window.electronAPI.logs.subscribe((log: Log) => {
      setLogs(prev => [...prev, log]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-x-0 top-0 z-50 h-fit w-full overflow-hidden">
        <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-lg bg-white dark:bg-[#1C2333] shadow-xl">
            <FeatureSteps
              features={dockerSetupFeatures}
              title="Dependency issue detected"
              autoPlayInterval={5000}
              className={className}
              // imageHeight="h-[300px]"
            />
            
            {/* Log Viewer */}
            <div className="mx-6 mb-6 p-4 bg-black/10 dark:bg-black/20 rounded-lg">
              <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Diagnostic Information
              </h3>
              <div className="h-32 overflow-y-auto font-mono text-xs space-y-1">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      "px-2 py-0.5 rounded",
                      {
                        'text-gray-700 dark:text-gray-300': log.level === 'info',
                        'text-yellow-600 dark:text-yellow-400': log.level === 'warn',
                        'text-red-600 dark:text-red-400': log.level === 'error',
                      }
                    )}
                  >
                    <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    {log.message}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 p-6 pt-0">
              <button
                onClick={onComplete}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
              >
                Check again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 