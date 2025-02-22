import { ServiceStatus } from '@/types/docker'
import { cn } from '@/lib/utils'
import { Activity, Cpu, Database, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ServiceMetricsProps {
  service: ServiceStatus
}

export function ServiceMetrics({ service }: ServiceMetricsProps) {
  if (!service.metrics || !service.health) return null

  const formatMemory = (memory: number) => {
    if (memory < 1024) return `${Math.round(memory)} MB`
    return `${(memory / 1024).toFixed(1)} GB`
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Health Status
        </h4>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            {
              'bg-green-500': service.health.status === 'healthy',
              'bg-red-500': service.health.status === 'unhealthy',
              'bg-gray-500': service.health.status === 'unknown'
            }
          )} />
          <span className={cn(
            "text-xs font-medium",
            {
              'text-green-600 dark:text-green-400': service.health.status === 'healthy',
              'text-red-600 dark:text-red-400': service.health.status === 'unhealthy',
              'text-gray-600 dark:text-gray-400': service.health.status === 'unknown'
            }
          )}>
            {service.health.status.charAt(0).toUpperCase() + service.health.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-medium">CPU Usage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, service.metrics.cpu)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {Math.round(service.metrics.cpu)}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Database className="w-4 h-4" />
            <span className="text-xs font-medium">Memory</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatMemory(service.metrics.memory)}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">Uptime</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatUptime(service.metrics.uptime)}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Connections</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {service.metrics.connections}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Last check: {formatDistanceToNow(new Date(service.health.lastCheck))} ago</span>
        {service.health.failureCount > 0 && (
          <span className="text-red-500">
            {service.health.failureCount} failure{service.health.failureCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  )
} 