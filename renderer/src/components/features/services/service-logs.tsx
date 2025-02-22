import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Terminal, X, Maximize2, Minimize2, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { LogEntry } from '@/types/docker'

interface ServiceLogsProps {
  serviceName: string
  isOpen: boolean
  onClose: () => void
}

export function ServiceLogs({ serviceName, isOpen, onClose }: ServiceLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  //const intervalRef = useRef<NodeJS.Timeout>()

  const fetchLogs = useCallback(async (): Promise<void> => {
    if (!isOpen) return
    
    setIsLoading(true)
    try {
      const newLogs = await window.electronAPI.docker.getLogs(serviceName)
      setLogs(newLogs)
    } catch (error) {
      toast.error('Failed to fetch logs', {
        description: 'Could not retrieve service logs. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, serviceName])

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined

    function pollLogs(this: void): void {
      void fetchLogs()
    }

    if (isOpen) {
      pollLogs()
      interval = setInterval(pollLogs, 5000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isOpen, serviceName, fetchLogs])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n'))
    toast.success('Logs copied to clipboard')
  }

  const downloadLogs = () => {
    const content = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${serviceName.toLowerCase()}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Logs downloaded successfully')
  }

  if (!isOpen) return null

  return (
    <div className={cn(
      "fixed inset-x-6 bottom-6 bg-white dark:bg-[#1C2333] rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg transition-all duration-300",
      isExpanded ? "top-6" : "h-96",
      "animate-in fade-in slide-in-from-bottom-4"
    )}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100/50 dark:bg-gray-800/50">
            <Terminal className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {serviceName} Logs
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live service logs and events
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg"
            onClick={copyLogs}
          >
            <Copy className="w-4 h-4" />
            <span className="sr-only">Copy logs</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg"
            onClick={downloadLogs}
          >
            <Download className="w-4 h-4" />
            <span className="sr-only">Download logs</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span className="sr-only">
              {isExpanded ? "Minimize" : "Maximize"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
      <div 
        className="relative flex-1 p-4 font-mono text-sm overflow-auto bg-gray-50 dark:bg-gray-900/50 rounded-b-xl"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
          setAutoScroll(scrollHeight - scrollTop === clientHeight)
        }}
      >
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            No logs available
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className={cn(
                  "whitespace-pre-wrap transition-colors duration-200",
                  {
                    'text-gray-800 dark:text-gray-200': log.level === 'info',
                    'text-yellow-600 dark:text-yellow-400': log.level === 'warn',
                    'text-red-600 dark:text-red-400': log.level === 'error',
                  }
                )}
              >
                <span className="text-gray-500 dark:text-gray-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                {log.message}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
} 