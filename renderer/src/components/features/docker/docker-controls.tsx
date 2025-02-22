import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DockerControlsProps {
  isRunning: boolean;
  isLoading: boolean;
  status: string;
  onToggle: (start: boolean) => Promise<void>;
}

export function DockerControls({ isRunning, isLoading, status, onToggle }: DockerControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => onToggle(true)}
          disabled={isLoading || isRunning}
          variant="ghost"
          className={cn(
            "text-sm font-medium",
            isRunning && "text-green-600 dark:text-green-400",
            !isRunning && "text-gray-500 dark:text-gray-400"
          )}
        >
          Start Docker
        </Button>
        <Button
          onClick={() => onToggle(false)}
          variant="ghost"
          disabled={isLoading || !isRunning}
          className={cn(
            "text-sm font-medium",
            !isRunning && "text-red-600 dark:text-red-400",
            isRunning && "text-gray-500 dark:text-gray-400"
          )}
        >
          Stop Docker
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-2 h-2 rounded-full",
          {
            "bg-green-500": isRunning,
            "bg-red-500": !isRunning,
            "animate-pulse": isLoading
          }
        )} />
      </div>
    </div>
  );
} 