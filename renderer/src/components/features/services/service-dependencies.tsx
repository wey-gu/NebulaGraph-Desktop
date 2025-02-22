import { ServiceStatus } from '@/types/docker'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'

interface ServiceDependenciesProps {
  service: ServiceStatus
}

type DependencyStatus = 'ok' | 'error' | 'warning'

interface Dependency {
  name: string
  required: boolean
  status: DependencyStatus
}

export function ServiceDependencies({ service }: ServiceDependenciesProps) {
  if (!service.dependencies || service.dependencies.length === 0) return null

  const getStatusIcon = (status: DependencyStatus) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  }

  const getStatusColor = (status: DependencyStatus) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100/10 text-green-700 dark:bg-green-500/10 dark:text-green-400';
      case 'error':
        return 'bg-red-100/10 text-red-700 dark:bg-red-500/10 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-100/10 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400';
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Dependencies
      </h4>
      <div className="space-y-2">
        {service.dependencies.map((dep: Dependency, index: number) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg transition-all duration-300",
              getStatusColor(dep.status)
            )}
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(dep.status)}
              <span className="text-sm font-medium">
                {dep.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {dep.required && (
                <span className="text-xs bg-gray-100/50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded">
                  Required
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 