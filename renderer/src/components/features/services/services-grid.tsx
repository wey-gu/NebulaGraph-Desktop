import { ServiceStatus } from '@/types/docker'
import { NebulaServiceCard } from './nebula-service-card'

interface ServicesGridProps {
  services: Record<string, ServiceStatus>
  isLoading?: boolean
  onServiceUpdate: () => Promise<void>
}

export function ServicesGrid({ services, isLoading, onServiceUpdate }: ServicesGridProps) {
  // Sort services in the correct order: metad -> storaged -> graphd -> studio
  const serviceOrder = ['metad', 'storaged', 'graphd', 'studio'];
  const sortedServices = Object.entries(services).sort(([a], [b]) => {
    return serviceOrder.indexOf(a) - serviceOrder.indexOf(b);
  });

  // Calculate service counts
  const totalServices = Object.keys(services).length;
  const notCreatedCount = Object.values(services).filter(s => 
    s.status === 'not_created' || s.health.status === 'not_created'
  ).length;
  const runningCount = Object.values(services).filter(s => 
    s.status === 'running' && s.health.status === 'healthy'
  ).length;

  // Get the status message
  const getStatusMessage = () => {
    if (notCreatedCount === totalServices) {
      return `${totalServices} services ready to be created`;
    }
    if (runningCount === totalServices) {
      return `All ${totalServices} services running`;
    }
    if (runningCount > 0) {
      return `${runningCount} of ${totalServices} services running`;
    }
    return `${totalServices} services`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 dark:from-purple-300 dark:via-pink-400 dark:to-purple-400">
          Services
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {getStatusMessage()}
        </p>
      </div>
      <div className="grid gap-4">
        {sortedServices.map(([id, service]) => (
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