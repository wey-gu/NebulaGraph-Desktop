import { ServiceStatus } from '@/types/docker';
import { cn } from '@/lib/utils';
import { 
  Activity, AlertCircle, CheckCircle2, XCircle, Globe, 
  Server, Database, ArrowUpRight, Terminal, Cpu, 
  RotateCw, Square, Play, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ServiceLogs } from './service-logs';
import { toast } from 'sonner';

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
        toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}ed ${service.name}`);
      } else if (result.error) {
        toast.error(`Failed to ${action} service`, {
          description: result.error
        });
      }
    } catch (error) {
      toast.error(`Failed to ${action} service`);
    }
    setLoadingAction(null);
  };

  const getServiceIcon = () => {
    switch (service.name) {
      case 'Studio':
        return <Globe className="w-5 h-5" />;
      case 'Meta Service':
        return <Server className="w-5 h-5" />;
      case 'Storage Service':
        return <Database className="w-5 h-5" />;
      case 'Graph Service':
        return <Activity className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  const formatMemory = (memory: number) => {
    if (memory < 1024) return `${Math.round(memory)} MB`;
    return `${(memory / 1024).toFixed(1)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className={cn(
      "rounded-lg p-4 border transition-all duration-300 group relative",
      "bg-white dark:bg-[#1C2333] border-gray-100 dark:border-gray-800/50",
      "hover:shadow-lg dark:hover:border-gray-700",
      isLoading && "animate-pulse",
      "hover:scale-[1.02]",
      "before:absolute before:inset-0 before:rounded-lg before:transition-opacity before:duration-300",
      "before:bg-gradient-to-r before:from-purple-500/10 before:via-pink-500/10 before:to-purple-500/10",
      "before:opacity-0 group-hover:before:opacity-100"
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-all duration-300 relative overflow-hidden",
              service.status === 'running' 
                ? 'bg-green-100/10 text-green-400 group-hover:bg-green-100/20' 
                : 'bg-gray-100/10 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 group-hover:bg-gray-100/20 dark:group-hover:bg-gray-800/80',
              "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
              "before:translate-x-[-200%] group-hover:before:translate-x-[200%] before:transition-transform before:duration-1000",
              service.status === 'running' && "before:animate-[shimmer_2s_infinite]"
            )}>
              <div className="relative">
                {getServiceIcon()}
                {service.status === 'running' && (
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
                  {service.name}
                </h3>
                {service.ports && service.ports.length > 0 && (
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
                    'bg-green-400 animate-pulse': service.status === 'running' && service.health === 'healthy',
                    'bg-yellow-400 animate-pulse': service.status === 'running' && service.health === 'unhealthy',
                    'bg-blue-400 animate-pulse': service.status === 'running' && service.health === 'starting',
                    'bg-red-400': service.status === 'stopped',
                    'bg-yellow-400': service.status === 'error'
                  }
                )} />
                <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {service.status === 'running' 
                    ? service.health === 'healthy' 
                      ? 'Healthy'
                      : service.health === 'unhealthy'
                      ? 'Unhealthy'
                      : 'Starting'
                    : service.status === 'stopped'
                    ? 'Stopped'
                    : 'Error'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {service.status === 'stopped' ? (
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-green-100/10 hover:text-green-400 hover:border-green-200/20"
                disabled={!!loadingAction}
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
                  className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-100/10 hover:text-red-400 hover:border-red-200/20"
                  disabled={!!loadingAction}
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
                  className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-yellow-100/10 hover:text-yellow-400 hover:border-yellow-200/20"
                  disabled={!!loadingAction}
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
            <Button
              variant="outline"
              size="icon"
              className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-purple-100/10 hover:text-purple-400 hover:border-purple-200/20"
              onClick={() => setShowLogs(true)}
            >
              <Terminal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Metrics */}
        {service.status === 'running' && service.metrics && (
          <div className="grid grid-cols-3 gap-3 pt-1">
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
            </div>

            <div className="flex items-center gap-2">
              <Database className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                {service.metrics.memory}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                {service.metrics.network}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Logs Dialog */}
      <ServiceLogs
        serviceName={service.name}
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
      />
    </div>
  );
} 