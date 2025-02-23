'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ServicesGrid } from '@/components/features/services/services-grid'
import { DockerAPI, ServiceStatus, MainProcessLog } from '@/types/docker'
import { HeroSection } from '@/components/blocks/hero-section-dark'
import { Spinner } from '@/components/ui/spinner'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import { Globe, ArrowUpRight, Info } from 'lucide-react'
import { toast } from 'sonner'
import { ServicesSkeleton } from '@/components/features/services/services-skeleton'
import { DockerSetupGuide } from '@/components/features/docker/docker-setup-guide'

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

export default function Home() {
  const [isDockerRunning, setIsDockerRunning] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('Checking Docker status...')
  const [services, setServices] = useState<Record<string, ServiceStatus>>({})
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showDashboard, setShowDashboard] = useState<boolean>(false)
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [showDockerSetup, setShowDockerSetup] = useState<boolean>(false)
  const [imageLoadingProgress, setImageLoadingProgress] = useState<{ current: number; total: number; status: string } | null>(null)

  // Add service status polling interval ref
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstLoad = useRef<boolean>(true)

  // Add image loading progress polling interval ref
  const imageLoadingPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Optimize service status polling
  const pollServicesStatus = useCallback(async () => {
    try {
      const services = await window.electronAPI.docker.getServices()
      setServices(services)
      
      // Check if any service is still starting
      const hasStartingServices = Object.values(services).some(
        s => s.health.status === 'starting'
      )

      // Check service states and set appropriate status
      const runningCount = Object.values(services).filter(s => s.health.status === 'healthy').length
      const totalServices = Object.keys(services).length
      const errorCount = Object.values(services).filter(s => s.health.status === 'unhealthy').length
      const notCreatedCount = Object.values(services).filter(s => s.status === 'not_created' || s.health.status === 'not_created').length
      
      if (hasStartingServices) {
        setStatus('Services are starting...')
      } else if (errorCount > 0) {
        setStatus(`${errorCount} service${errorCount > 1 ? 's' : ''} in error state`)
      } else if (notCreatedCount === totalServices) {
        setStatus('Services not created yet')
      } else if (runningCount === 0) {
        setStatus('All services are stopped')
      } else if (runningCount === totalServices) {
        setStatus('All services are running')
      } else {
        setStatus(`${runningCount} of ${totalServices} services running`)
      }

      // Adjust polling interval based on service state
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current)
      }

      statusPollingRef.current = setInterval(() => {
        pollServicesStatus()
      }, hasStartingServices ? 2000 : 5000) // Poll faster when services are starting
    } catch (error) {
      console.error('Failed to poll services:', error)
      setStatus('Error checking service status')
    }
  }, [])

  // Poll image loading progress
  const pollImageLoadingProgress = useCallback(async () => {
    try {
      const progress = await window.electronAPI.docker.getImageLoadingProgress();
      setImageLoadingProgress(progress);
      
      // If still loading, continue polling
      if (progress) {
        imageLoadingPollingRef.current = setTimeout(pollImageLoadingProgress, 1000);
      }
    } catch (error) {
      console.error('Failed to poll image loading progress:', error);
    }
  }, []);

  // Optimize initial load
  const initializeApp = useCallback(async () => {
    try {
      // Quick Docker status check first
      const result = await window.electronAPI.docker.status()
      setIsDockerRunning(result)

      if (!result) {
        setStatus('Docker is not running')
        setShowDockerSetup(true)
        setIsInitialLoading(false)
        return
      }

      // Start polling service status immediately
      await pollServicesStatus()
      
      // Only show setup guide if needed
      const systemStatus = await window.electronAPI.docker.systemStatus()
      if (!systemStatus.isInstalled || !systemStatus.compose?.isInstalled) {
        setShowDockerSetup(true)
      }
    } catch (error) {
      console.error('Error initializing app:', error)
      setStatus('Error checking Docker status')
      setShowDockerSetup(true)
    } finally {
      setIsInitialLoading(false)
    }
  }, [pollServicesStatus])

  // Handle cleanup
  useEffect(() => {
    return () => {
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current)
      }
    }
  }, [])

  // Initialize app
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      initializeApp()
      // Start polling image loading progress
      pollImageLoadingProgress()
    }
  }, [initializeApp, pollImageLoadingProgress])

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (imageLoadingPollingRef.current) {
        clearTimeout(imageLoadingPollingRef.current)
      }
    }
  }, [])

  const startNebulaGraph = async () => {
    setIsLoading(true)
    setStatus('Starting NebulaGraph services...')
    
    try {
      const result = await window.electronAPI.docker.start()
      
      if (result.success) {
        setStatus('NebulaGraph services started successfully')
        await pollServicesStatus()
        toast.success('NebulaGraph services started')
      } else {
        setStatus(`Failed to start services: ${result.error}`)
        toast.error('Failed to start services', {
          description: result.error || 'An unknown error occurred.'
        })
      }
    } catch (error) {
      console.error('Start error:', error)
      setStatus('Error starting services')
      toast.error('Error starting services')
    } finally {
      setIsLoading(false)
    }
  }

  const stopNebulaGraph = async () => {
    if (!window.electronAPI?.docker) return
    
    console.log('⏹️ Stopping NebulaGraph services...')
    setIsLoading(true)
    setStatus('Stopping NebulaGraph services...')
    try {
      const result = await window.electronAPI.docker.stop()
      console.log('✓ Stop result:', result)
      
      if (result.success) {
        setStatus('NebulaGraph services stopped successfully')
        await pollServicesStatus()
        console.log('✓ Services after stop:', services)
        toast.success('NebulaGraph services stopped', {
          description: 'All services have been stopped.'
        })
      } else {
        console.error('✕ Stop failed:', result.error)
        setStatus(`Failed to stop services: ${result.error}`)
        toast.error('Failed to stop services', {
          description: result.error || 'An unknown error occurred.'
        })
      }
    } catch (error) {
      console.error('✕ Stop error:', error)
      setStatus('Error stopping services')
      toast.error('Error stopping services', {
        description: 'Please try again or check the logs for more details.'
      })
    }
    setIsLoading(false)
  }

  const openStudio = () => {
    if (!window.electronAPI?.docker) return
    
    console.log('🌐 Opening NebulaGraph Studio...')
    if (!Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy')) {
      console.warn('⚠️ Studio is not running')
      toast.error('Studio is not available', {
        description: 'Please make sure all services are running first.'
      })
      return
    }

    window.electronAPI.browser.openExternal('http://localhost:7001')
      .then(() => {
        toast.success('Opening NebulaGraph Studio', {
          description: 'Please note the IP address for graphd is `graphd`'
        })
      })
      .catch(error => {
        console.error('Failed to open Studio:', error)
        toast.error('Failed to open Studio', {
          description: 'Please try opening http://localhost:7001 manually in your browser.'
        })
      })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F17] text-black dark:text-white">
      {showDockerSetup && (
        <DockerSetupGuide onComplete={initializeApp} />
      )}
      {!showDashboard ? (
        <HeroSection
          title="Open Source Graph Database"
          subtitle={{
            regular: "Graph Infra for AI Era, ",
            gradient: "Distributed Graph at Scale",
          }}
          description="NebulaGraph is a popular open-source graph database that can handle large volumes of data with milliseconds of latency, scale up quickly, and have the ability to perform fast graph analytics. NebulaGraph has been widely used for social media, recommendation systems, knowledge graphs, security, capital flows, AI, etc."
          ctaText="Launch NebulaGraph Desktop Console"
          ctaHref="https://github.com/vesoft-inc/nebula"
          bottomImage={{
            light: "./nebula_arch.mp4",
            dark: "./nebula_arch.mp4",
          }}
          gridOptions={{
            angle: 65,
            opacity: 0.4,
            cellSize: 50,
            lightLineColor: "rgba(74, 74, 74, 0.1)",
            darkLineColor: "rgba(42, 42, 42, 0.3)",
          }}
          onClick={async () => {
            // First show the dashboard
            setShowDashboard(true);
            // Then check and load images if needed
            const result = await window.electronAPI.docker.ensureImagesLoaded();
            if (!result) {
              toast.error('Failed to load Docker images', {
                description: 'Please make sure Docker is running and try again.'
              });
            }
          }}
          className="animate-fade-in"
        />
      ) : isInitialLoading ? (
        <ServicesSkeleton />
      ) : (
        <div className="container mx-auto px-4 py-8 max-w-7xl animate-slide-up">
          {/* Loading Overlay */}
          {imageLoadingProgress && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white dark:bg-[#1C2333] p-8 rounded-xl shadow-xl max-w-md w-full mx-4">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-center">Preparing NebulaGraph</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
                    {imageLoadingProgress.status}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(imageLoadingProgress.current / imageLoadingProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    {imageLoadingProgress.current} of {imageLoadingProgress.total} images
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <header className="mb-12 flex items-center justify-between animate-slide-down">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setShowDashboard(false)}
                className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all"
              >
                <span className="transform transition-transform group-hover:-translate-x-1">←</span>
                {/* <span><HomeIcon className="w-4 h-4" /></span> */}
              </button>
              <div>
                <h1 className="text-4xl font-bold tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 dark:from-purple-300 dark:via-pink-400 dark:to-purple-400">
                    Console
                  </span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage NebulaGraph Desktop services
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={cn(
                "text-sm px-3 py-1.5 rounded-full transition-all duration-300",
                isLoading 
                  ? "bg-purple-100/10 text-purple-400 animate-pulse" 
                  : status.toLowerCase().includes('error')
                  ? "bg-red-100/10 text-red-400"
                  : "bg-gray-100 dark:bg-[#1C2333]"
              )}>
                <div className="flex items-center gap-2">
                  {isLoading && <Spinner size="sm" />}
                  {status}
                </div>
              </div>
              <ThemeToggle />
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="col-span-4 grid grid-cols-4 gap-4">
              <div className="col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl p-6 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in group hover:scale-[1.02]">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Services</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {Object.values(services).filter(s => s.health.status === 'healthy').length}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / {Object.keys(services).length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 rounded-full transition-all duration-500 group-hover:scale-x-105"
                        style={{ width: `${Object.keys(services).length === 0 ? 0 : Math.round((Object.values(services).filter(s => s.health.status === 'healthy').length / Object.keys(services).length) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.keys(services).length === 0 ? '0%' : `${Math.round((Object.values(services).filter(s => s.health.status === 'healthy').length / Object.keys(services).length) * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl p-6 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in [animation-delay:100ms] hover:scale-[1.02]">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Docker</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {isDockerRunning ? 'Active' : 'Inactive'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      isDockerRunning ? "bg-green-500" : "bg-red-500"
                    )} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {isDockerRunning ? 'System ready' : 'System offline'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl p-6 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in [animation-delay:150ms] hover:scale-[1.02]">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Health</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {Object.values(services).filter(s => s.health.status === 'unhealthy').length === 0 ? 'Good' : 'Warning'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      Object.values(services).filter(s => s.health.status === 'unhealthy').length === 0 ? "bg-green-500" : "bg-yellow-500"
                    )} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.values(services).filter(s => s.health.status === 'unhealthy').length === 0 ? 'All systems normal' : `${Object.values(services).filter(s => s.health.status === 'unhealthy').length} issues found`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl p-6 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in [animation-delay:200ms] hover:scale-[1.02]">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Studio</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy') ? 'Ready' : 'Offline'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy') ? "bg-green-500" : "bg-gray-500"
                    )} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy') ? 'Web console ready' : 'Console unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-white dark:bg-[#1C2333] rounded-2xl p-8 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in [animation-delay:300ms] hover:scale-[1.01] group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 dark:from-purple-300 dark:via-pink-400 dark:to-purple-400 group-hover:scale-[1.02] transition-transform duration-300">
                    Controls
                  </h2>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300",
                    isDockerRunning 
                      ? "bg-green-100/10 text-green-400 group-hover:bg-green-100/20" 
                      : "bg-red-100/10 text-red-400 group-hover:bg-red-100/20"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isDockerRunning ? "bg-green-400 animate-pulse" : "bg-red-400"
                      )} />
                      {isDockerRunning ? "Docker Ready" : "Docker Offline"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    onClick={startNebulaGraph}
                    disabled={isLoading || !isDockerRunning}
                    className={cn(
                      "w-full sm:w-auto px-8 py-6 transition-all duration-300",
                      "rounded-xl text-sm font-medium select-none",
                      "bg-gradient-to-tr from-zinc-300/20 via-purple-400/30 to-transparent dark:from-zinc-300/5 dark:via-purple-400/20",
                      "text-gray-700 dark:text-gray-200",
                      "border border-gray-200 dark:border-gray-800",
                      "hover:bg-gradient-to-tr hover:from-zinc-300/30 hover:via-purple-400/40 hover:to-transparent dark:hover:from-zinc-300/10 dark:hover:via-purple-400/30",
                      "hover:text-gray-900 dark:hover:text-white",
                      "hover:scale-[1.02] hover:z-10",
                      "active:scale-[0.98] active:duration-200",
                      "disabled:opacity-50",
                      "disabled:hover:bg-none disabled:hover:scale-100",
                      "disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400",
                      "group/btn relative",
                      isLoading && "animate-pulse"
                    )}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <Spinner size="sm" className="text-gray-700 dark:text-gray-200" />
                        <span className="font-medium"></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover/btn:bg-gray-200 dark:group-hover/btn:bg-gray-700 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600 dark:bg-gray-300 group-hover/btn:scale-110 transition-transform" />
                        </div>
                        <span className="font-medium">Start All</span>
                      </div>
                    )}
                  </button>
                  
                  <button
                    onClick={stopNebulaGraph}
                    disabled={isLoading || !isDockerRunning}
                    className={cn(
                      "w-full sm:w-auto px-8 py-6 transition-all duration-300",
                      "rounded-xl text-sm font-medium select-none",
                      "bg-white/5 dark:bg-gray-900/50",
                      "border border-gray-200 dark:border-gray-800",
                      "text-gray-600 dark:text-gray-300",
                      "hover:bg-gray-50 dark:hover:bg-gray-800/80",
                      "hover:border-gray-300 dark:hover:border-gray-700",
                      "hover:text-gray-900 dark:hover:text-white",
                      "hover:scale-[1.02] hover:z-10",
                      "active:scale-[0.98] active:duration-200",
                      "disabled:opacity-50",
                      "disabled:hover:bg-none disabled:hover:scale-100",
                      "disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400",
                      "group/stop relative",
                      isLoading && "animate-pulse"
                    )}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <Spinner size="sm" className="text-gray-600 dark:text-gray-300" />
                        <span className="font-medium"></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover/stop:bg-gray-200 dark:group-hover/stop:bg-gray-700 transition-all duration-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-gray-300 group-hover/stop:bg-gray-700 dark:group-hover/stop:bg-gray-200 transition-colors" />
                        </div>
                        <span className="font-medium">Stop All</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-white dark:bg-[#1C2333] rounded-2xl p-8 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in [animation-delay:400ms] hover:scale-[1.01] group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 dark:from-purple-300 dark:via-pink-400 dark:to-purple-400 group-hover:scale-[1.02] transition-transform duration-300">
                    Studio
                  </h2>
                  <div className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
                    Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy')
                      ? "bg-green-100/10 text-green-400 group-hover:bg-green-100/20"
                      : "bg-gray-100/10 text-gray-400 group-hover:bg-gray-100/20"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy') 
                          ? "bg-green-400 animate-pulse" 
                          : "bg-gray-400"
                      )} />
                      :7001
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={openStudio}
                    disabled={!Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy')}
                    className={cn(
                      "w-full sm:w-auto px-8 py-6 transition-all duration-300",
                      "rounded-xl text-sm font-medium select-none",
                      "bg-gradient-to-tr from-zinc-300/20 via-blue-400/30 to-transparent dark:from-zinc-300/5 dark:via-blue-400/20",
                      "text-gray-700 dark:text-gray-200",
                      "border border-gray-200 dark:border-gray-800",
                      "hover:bg-gradient-to-tr hover:from-zinc-300/30 hover:via-blue-400/40 hover:to-transparent dark:hover:from-zinc-300/10 dark:hover:via-blue-400/30",
                      "hover:text-gray-900 dark:hover:text-white",
                      "hover:scale-[1.02] hover:z-10",
                      "active:scale-[0.98] active:duration-200",
                      "disabled:opacity-50",
                      "disabled:hover:bg-none disabled:hover:scale-100",
                      "disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400",
                      "group/btn relative"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-gray-500 dark:text-gray-300 group-hover/btn:rotate-12 transition-transform duration-300" />
                      <span className="font-medium">Launch Studio</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300 opacity-0 group-hover/btn:opacity-100 transition-all duration-300 group-hover/btn:translate-x-1" />
                    </div>
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {Object.values(services).some(s => s.name === 'studio' && s.health.status === 'healthy')
                      ? <span className="flex items-center gap-1"><Info className="w-3.5 h-3.5" /> IP address: `graphd`</span>
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-span-4 bg-white dark:bg-[#1C2333] rounded-2xl p-8 border border-gray-100 dark:border-gray-800/50 shadow-sm hover:shadow transition-all duration-300 animate-scale-in [animation-delay:500ms] hover:scale-[1.01]">
              <ServicesGrid 
                services={services}
                isLoading={isLoading} 
                onServiceUpdate={pollServicesStatus}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
