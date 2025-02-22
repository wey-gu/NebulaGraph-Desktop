import { ServiceStatus } from '@/types/docker'
import { NebulaServiceCard } from './nebula-service-card'

interface ServicesGridProps {
  services: Record<string, ServiceStatus>
  isLoading?: boolean
  onServiceUpdate: () => Promise<void>
}

export function ServicesGrid({ services, isLoading, onServiceUpdate }: ServicesGridProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 dark:from-purple-300 dark:via-pink-400 dark:to-purple-400">
          Services
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {Object.keys(services).length} service{Object.keys(services).length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="grid gap-4">
        {Object.entries(services).map(([id, service]) => (
          <NebulaServiceCard
            key={id}
            service={service}
            isLoading={isLoading}
            onServiceUpdate={onServiceUpdate}
          />
        ))}
      </div>
    </div>
  );
} 