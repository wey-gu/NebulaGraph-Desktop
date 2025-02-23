'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Terminal, X, Maximize2, Minimize2, Copy, Download, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { LogEntry } from '@/types/docker'
import { useClickAway } from '@/hooks/use-click-away'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'

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
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all')
  const [mounted, setMounted] = useState(false)
  
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useClickAway(containerRef as React.RefObject<HTMLElement>, () => {
    if (isOpen) onClose()
  })

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

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
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, serviceName])

  // Handle log polling
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined

    if (isOpen) {
      void fetchLogs()
      interval = setInterval(fetchLogs, 5000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isOpen, fetchLogs])

  // Handle auto-scrolling with debounce
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [logs, autoScroll])

  // Handle keyboard events
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Handle resize observer for content height
  useEffect(() => {
    if (contentRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (autoScroll) {
          logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      })

      resizeObserverRef.current.observe(contentRef.current)
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
    }
  }, [autoScroll])

  const copyLogs = () => {
    const filteredLogs = logs
      .filter(log => filter === 'all' || log.level === filter)
      .map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`)
      .join('\n')
    
    navigator.clipboard.writeText(filteredLogs)
    toast.success('Logs copied to clipboard')
  }

  const downloadLogs = () => {
    const filteredLogs = logs
      .filter(log => filter === 'all' || log.level === filter)
      .map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`)
      .join('\n')
    
    const blob = new Blob([filteredLogs], { type: 'text/plain' })
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

  const filteredLogs = logs.filter(log => filter === 'all' || log.level === filter)
  const errorCount = logs.filter(log => log.level === 'error').length
  const warnCount = logs.filter(log => log.level === 'warn').length
  const infoCount = logs.filter(log => log.level === 'info').length

  if (!mounted || !isOpen) return null

  const content = (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "relative w-full bg-white dark:bg-[#1C2333] rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl",
            "max-w-6xl max-h-[85vh] flex flex-col",
            isExpanded ? "h-[85vh]" : "h-[600px]"
          )}
        >
          {/* Header */}
          <div className="flex-none flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
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

            {/* Filters */}
            <div className="flex items-center gap-2 px-2">
              <FilterButton
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                count={logs.length}
                label="All"
              />
              <FilterButton
                active={filter === 'error'}
                onClick={() => setFilter('error')}
                count={errorCount}
                label="Errors"
                variant="error"
              />
              <FilterButton
                active={filter === 'warn'}
                onClick={() => setFilter('warn')}
                count={warnCount}
                label="Warnings"
                variant="warning"
              />
              <FilterButton
                active={filter === 'info'}
                onClick={() => setFilter('info')}
                count={infoCount}
                label="Info"
                variant="info"
              />
            </div>

            <div className="flex items-center gap-2">
              <ActionButton
                icon={Copy}
                onClick={copyLogs}
                label="Copy logs"
              />
              <ActionButton
                icon={Download}
                onClick={downloadLogs}
                label="Download logs"
              />
              <ActionButton
                icon={isExpanded ? Minimize2 : Maximize2}
                onClick={() => setIsExpanded(!isExpanded)}
                label={isExpanded ? "Minimize" : "Maximize"}
              />
              <ActionButton
                icon={X}
                onClick={onClose}
                label="Close"
              />
            </div>
          </div>

          {/* Content */}
          <div 
            ref={contentRef}
            className="flex-1 p-4 font-mono text-sm overflow-auto bg-gray-50 dark:bg-gray-900/50 rounded-b-xl"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
              const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10
              setAutoScroll(isAtBottom)
            }}
          >
            {isLoading && logs.length === 0 ? (
              <LoadingState />
            ) : logs.length === 0 ? (
              <EmptyState />
            ) : (
              <LogsList logs={filteredLogs} logsEndRef={logsEndRef as React.RefObject<HTMLDivElement>} />
            )}

            {/* Auto-scroll indicator */}
            {!autoScroll && (
              <ScrollToBottomButton
                onClick={() => {
                  setAutoScroll(true)
                  logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                }}
              />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

// Helper Components
function FilterButton({ active, onClick, count, label, variant }: {
  active: boolean
  onClick: () => void
  count: number
  label: string
  variant?: 'error' | 'warning' | 'info'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-2 py-1 rounded-md transition-colors",
        active && variant === 'error' && "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
        active && variant === 'warning' && "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
        active && variant === 'info' && "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
        active && !variant && "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white",
        !active && "text-gray-500 hover:text-gray-900 dark:hover:text-white"
      )}
    >
      {label} ({count})
    </button>
  )
}

function ActionButton({ icon: Icon, onClick, label }: {
  icon: typeof Copy
  onClick: () => void
  label: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-lg"
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
      No logs available
    </div>
  )
}

function LogsList({ logs, logsEndRef }: { 
  logs: LogEntry[], 
  logsEndRef: React.RefObject<HTMLDivElement> 
}) {
  return (
    <div className="space-y-1">
      {logs.map((log, index) => (
        <div
          key={index}
          className={cn(
            "px-2 py-0.5 rounded transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800/50",
            {
              'text-gray-800 dark:text-gray-200': log.level === 'info',
              'text-yellow-600 dark:text-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10': log.level === 'warn',
              'text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10': log.level === 'error',
            }
          )}
        >
          <span className="text-gray-500 dark:text-gray-400 tabular-nums">
            [{new Date(log.timestamp).toLocaleTimeString()}]
          </span>{' '}
          {log.message}
        </div>
      ))}
      <div ref={logsEndRef} />
    </div>
  )
}

function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="fixed bottom-8 right-8 bg-white dark:bg-gray-800 shadow-lg"
      onClick={onClick}
    >
      <ArrowDown className="w-4 h-4 mr-2" />
      Scroll to Bottom
    </Button>
  )
} 