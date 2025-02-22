import { ServiceStatus } from '@/types/docker';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Activity, AlertCircle, CheckCircle2, XCircle, Globe, Server, Database, ArrowUpRight, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ServiceLogs } from './service-logs';

interface ServiceCardProps {
  service: ServiceStatus;
  isLoading?: boolean;
}

export function ServiceCard({ service, isLoading }: ServiceCardProps) {
  const [showLogs, setShowLogs] = useState(false);

  const getStatusIcon = () => {
    if (isLoading) return <Spinner size="sm" />;
    switch (service.status) {
      case 'running':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'stopped':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
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

  const getStatusColor = () => {
    switch (service.status) {
      case 'running':
        return 'bg-green-50/5 dark:bg-green-900/5 border-green-100/10 dark:border-green-900/20';
      case 'stopped':
        return 'bg-red-50/5 dark:bg-red-900/5 border-red-100/10 dark:border-red-900/20';
      case 'error':
        return 'bg-yellow-50/5 dark:bg-yellow-900/5 border-yellow-100/10 dark:border-yellow-900/20';
      default:
        return 'bg-gray-50/5 dark:bg-gray-900/5 border-gray-100/10 dark:border-gray-800/20';
    }
  };

  const getServiceName = (fullName: string) => {
    return fullName.replace('NebulaGraph ', '');
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'running':
        return 'Operational';
      case 'stopped':
        return 'Inactive';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-xl p-6 border transition-all duration-300 group relative",
          getStatusColor(),
          isLoading && "animate-pulse",
          "hover:scale-[1.02]",
          "before:absolute before:inset-0 before:rounded-xl before:transition-opacity before:duration-300",
          "before:bg-gradient-to-r before:from-purple-500/10 before:via-pink-500/10 before:to-purple-500/10",
          "before:opacity-0 group-hover:before:opacity-100"
        )}
      >
        <div className="space-y-4 relative">
          <div className="flex items-start justify-between">
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
                <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all duration-300">{getServiceName(service.name)}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {getStatusMessage(service.status)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                onClick={() => setShowLogs(true)}
              >
                <Terminal className="w-4 h-4" />
                <span className="sr-only">View logs</span>
              </Button>
              <div className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-300",
                {
                  "bg-green-100/10 text-green-400 group-hover:bg-green-100/20": service.status === 'running',
                  "bg-red-100/10 text-red-400 group-hover:bg-red-100/20": service.status === 'stopped',
                  "bg-yellow-100/10 text-yellow-400 group-hover:bg-yellow-100/20": service.status === 'error',
                }
              )}>
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover:scale-110",
                    {
                      "bg-green-400 animate-pulse": service.status === 'running',
                      "bg-red-400": service.status === 'stopped',
                      "bg-yellow-400": service.status === 'error',
                    }
                  )} />
                  {getStatusIcon()}
                  <span className="capitalize">{service.status}</span>
                </div>
              </div>
            </div>
          </div>

          {service.ports && (
            <div className="flex flex-wrap gap-2 pt-2">
              {service.ports.map((port) => (
                <a
                  key={port}
                  href={`http://localhost:${port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center gap-1 rounded-full bg-purple-100/10 dark:bg-purple-900/20 px-2.5 py-0.5 text-xs font-medium text-purple-400 hover:bg-purple-100/20 dark:hover:bg-purple-900/30 transition-all duration-300 hover:scale-105"
                >
                  <span className="relative">
                    <span className="absolute -inset-1 bg-purple-400/20 rounded-full blur-sm opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"></span>
                    <span className="relative">:{port}</span>
                  </span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-all duration-300 group-hover/link:translate-x-0.5 group-hover/link:translate-y-[-2px]" />
                </a>
              ))}
            </div>
          )}

          {service.status === 'error' && (
            <div className="pt-2">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-red-500/5 to-red-500/10 animate-pulse"></div>
                <p className="text-sm text-red-400 bg-red-100/10 dark:bg-red-900/20 rounded-lg px-3 py-2 border border-red-100/20 dark:border-red-900/30 relative">
                  Service failed to start properly
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <ServiceLogs
        serviceName={service.name}
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
      />
    </>
  );
} 