import { ServiceStatus } from '@/types/docker';
import { cn } from '@/lib/utils';
import { 
  Activity, Globe, 
  Server, Database, Terminal, Cpu, 
  RotateCw, Square, Play, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ServiceLogs } from './service-logs';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';

interface NebulaServiceCardProps {
  service: ServiceStatus;
  isLoading?: boolean;
  onServiceUpdate: () => Promise<void>;
}

export function NebulaServiceCard({ service, isLoading, onServiceUpdate }: NebulaServiceCardProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleServiceAction = async (action: 'start' | 'stop' | 'restart') => {
    setLoadingAction(action);
    try {
      let result;
      switch (action) {
        case 'start':
          result = await window.electronAPI.docker.startService(service.name);
          break;
        case 'stop':
          result = await window.electronAPI.docker.stopService(service.name);
          break;
        case 'restart':
          result = await window.electronAPI.docker.restartService(service.name);
          break;
      }

      if (result.success) {
        await onServiceUpdate();
        toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}ed ${getServiceDisplayName(service.name)}`);
      } else if (result.error) {
        toast.error(`Failed to ${action} service`, {
          description: result.error
        });
      }
    } catch (error) {
      toast.error(`Failed to ${action} service`);
      console.error('Failed to start service:', error);
    }
    setLoadingAction(null);
  };

  const getServiceDisplayName = (name: string) => {
    switch (name) {
      case 'studio':
        return 'NebulaGraph Studio';
      case 'metad':
        return 'Meta Service';
      case 'storaged':
        return 'Storage Service';
      case 'graphd':
        return 'Graph Service';
      default:
        return name;
    }
  };

  const getServiceIcon = () => {
    switch (service.name) {
      case 'studio':
        return <Globe className="w-5 h-5" />;
      case 'metad':
        return <Server className="w-5 h-5" />;
      case 'storaged':
        return <Database className="w-5 h-5" />;
      case 'graphd':
        return <Activity className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  const formatMemory = (memory: number) => {
    if (memory < 1024) return `${Math.round(memory)} MB`;
    return `${(memory / 1024).toFixed(1)} GB`;
  };

  // const formatUptime = (seconds: number) => {
  //   const hours = Math.floor(seconds / 3600);
  //   const minutes = Math.floor((seconds % 3600) / 60);
  //   if (hours > 0) return `${hours}h ${minutes}m`;
  //   return `${minutes}m`;
  // };

  const isServiceNotCreated = service.status === 'not_created' || service.health.status === 'not_created';
  const isServiceRunning = service.status === 'running' && service.health.status === 'healthy';

  return (
    <>
      <div className={cn(
        "rounded-lg p-4 border transition-all duration-300 group relative",
        "bg-white dark:bg-[#1C2333] border-gray-100 dark:border-gray-800/50",
        "hover:shadow-lg dark:hover:border-gray-700",
        isLoading && "animate-pulse",
        "hover:scale-[1.02]",
        "before:absolute before:inset-0 before:rounded-lg before:transition-opacity before:duration-300",
        "before:bg-gradient-to-r before:from-purple-500/10 before:via-pink-500/10 before:to-purple-500/10",
        "before:opacity-0 group-hover:before:opacity-100",
        showLogs && "z-40"
      )}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg transition-all duration-300 relative overflow-hidden",
                isServiceRunning 
                  ? 'bg-green-100/10 text-green-400 group-hover:bg-green-100/20' 
                  : 'bg-gray-100/10 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 group-hover:bg-gray-100/20 dark:group-hover:bg-gray-800/80',
                "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
                "before:translate-x-[-200%] group-hover:before:translate-x-[200%] before:transition-transform before:duration-1000",
                isServiceRunning && "before:animate-[shimmer_2s_infinite]"
              )}>
                <div className="relative">
                  {getServiceIcon()}
                  {isServiceRunning && (
                    <div className="absolute -right-1 -bottom-1 w-2 h-2">
                      <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
                      <div className="relative bg-green-400 rounded-full w-2 h-2"></div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all duration-300">
                    {getServiceDisplayName(service.name)}
                  </h3>
                  {!isServiceNotCreated && service.ports && service.ports.length > 0 && (
                    <div className="flex gap-1">
                      {service.ports.map((port) => (
                        <a
                          key={port}
                          href={`http://localhost:${port}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/link inline-flex items-center gap-1 rounded-full bg-purple-100/10 dark:bg-purple-900/20 px-1.5 py-0.5 text-xs font-medium text-purple-400 hover:bg-purple-100/20 dark:hover:bg-purple-900/30 transition-all duration-300 hover:scale-105"
                        >
                          <span className="relative">
                            <span className="absolute -inset-1 bg-purple-400/20 rounded-full blur-sm opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"></span>
                            <span className="relative">:{port}</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-transform duration-300 group-hover:scale-110",
                    {
                      'bg-green-400 animate-pulse': isServiceRunning,
                      'bg-gray-400': isServiceNotCreated,
                      'bg-yellow-400': !isServiceNotCreated && service.health.status === 'unhealthy',
                      'bg-blue-400': !isServiceNotCreated && service.health.status === 'starting',
                      'bg-gray-400 opacity-50': !isServiceNotCreated && service.health.status === 'unknown'
                    }
                  )} />
                  <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                    {isServiceNotCreated ? 'Not Created' :
                      service.health.status === 'healthy' ? 'Healthy' :
                      service.health.status === 'unhealthy' ? 'Unhealthy' :
                      service.health.status === 'starting' ? 'Starting' :
                      'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300",
                  "hover:bg-purple-100/10 hover:text-purple-400 hover:border-purple-200/20",
                  "z-20",
                  showLogs && "bg-purple-100/10 text-purple-400 border-purple-200/20"
                )}
                onClick={() => setShowLogs(true)}
                disabled={isServiceNotCreated}
              >
                <Terminal className="w-4 h-4" />
                <span className="sr-only">View logs</span>
              </Button>
              {service.status === 'stopped' ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-green-100/10 hover:text-green-400 hover:border-green-200/20 z-20"
                  disabled={!!loadingAction || isServiceNotCreated}
                  onClick={() => handleServiceAction('start')}
                >
                  {loadingAction === 'start' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-100/10 hover:text-red-400 hover:border-red-200/20 z-20"
                    disabled={!!loadingAction || isServiceNotCreated}
                    onClick={() => handleServiceAction('stop')}
                  >
                    {loadingAction === 'stop' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-yellow-100/10 hover:text-yellow-400 hover:border-yellow-200/20 z-20"
                    disabled={!!loadingAction || isServiceNotCreated}
                    onClick={() => handleServiceAction('restart')}
                  >
                    {loadingAction === 'restart' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCw className="w-4 h-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Metrics */}
          {isServiceRunning && service.metrics && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {/* CPU Usage */}
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        parseFloat(service.metrics.cpu) > 80 ? "bg-red-500" :
                        parseFloat(service.metrics.cpu) > 60 ? "bg-yellow-500" :
                        "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(100, parseFloat(service.metrics.cpu))}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                    {service.metrics.cpu}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">CPU Usage</p>
              </div>

              {/* Memory Usage */}
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        parseFloat(service.metrics.memory) > 1024 ? "bg-red-500" :
                        parseFloat(service.metrics.memory) > 512 ? "bg-yellow-500" :
                        "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(100, (parseFloat(service.metrics.memory) / 1024) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                    {formatMemory(parseFloat(service.metrics.memory))}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Memory</p>
              </div>

              {/* Network I/O */}
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                        {service.metrics.network}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Network I/O</p>
              </div>
            </div>
          )}

          {/* Not Created Message */}
          {isServiceNotCreated && (
            <div className="pt-2">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 via-gray-500/5 to-gray-500/10"></div>
                <p className="text-sm text-gray-400 bg-gray-100/10 dark:bg-gray-900/20 rounded-lg px-3 py-2 border border-gray-100/20 dark:border-gray-800/30 relative">
                  Service will be created when you start NebulaGraph
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Render logs portal outside the card to prevent layout issues */}
      <AnimatePresence>
        {showLogs && (
          <ServiceLogs
            key={`${service.name}-logs`}
            serviceName={service.name}
            isOpen={showLogs}
            onClose={() => setShowLogs(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
} 