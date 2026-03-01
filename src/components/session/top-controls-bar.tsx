'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSessionStore, type ResponseStyle, type TransportType } from '@/stores/session-store'
import {
  Mic,
  MicOff,
  Square,
  Radio,
  Settings,
  Keyboard,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Zap,
  ChevronDown,
} from 'lucide-react'

interface TopControlsBarProps {
  className?: string
  onStartListening: () => void
  onStopListening: () => void
  onCancelAnswer: () => void
  audioLevel?: number
  shortcuts?: { key: string; description: string }[]
}

const RESPONSE_STYLES: { value: ResponseStyle; label: string; description: string }[] = [
  { value: 'short', label: 'Short', description: '1-2 sentence answers' },
  { value: 'star', label: 'STAR Method', description: 'Structured interview answers' },
  { value: 'detailed', label: 'Detailed', description: 'Comprehensive answers' },
  { value: 'technical', label: 'Technical', description: 'Code and technical details' },
  { value: 'custom', label: 'Custom', description: 'Your own prompt' },
]

export function TopControlsBar({
  className,
  onStartListening,
  onStopListening,
  onCancelAnswer,
  audioLevel = 0,
  shortcuts = [],
}: TopControlsBarProps) {
  const [showStyleMenu, setShowStyleMenu] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const {
    isConnected,
    isConnecting,
    connectionError,
    isListening,
    isPaused,
    orchestratorState,
    responseStyle,
    customStylePrompt,
    autoAnswer,
    transport,
    currentAnswer,
    setResponseStyle,
    setCustomStylePrompt,
    setAutoAnswer,
    setTransport,
    togglePause,
  } = useSessionStore()

  const styleButtonRef = useRef<HTMLButtonElement>(null)

  // Open style menu on Ctrl+S
  useEffect(() => {
    if (showStyleMenu) {
      styleButtonRef.current?.click()
    }
  }, [showStyleMenu])

  const handleStyleChange = (value: ResponseStyle) => {
    setResponseStyle(value)
  }

  const handleListeningToggle = () => {
    if (isListening) {
      onStopListening()
    } else {
      onStartListening()
    }
  }

  const getStatusColor = () => {
    if (connectionError) return 'bg-red-500'
    if (isConnecting) return 'bg-yellow-500 animate-pulse'
    if (isConnected) return 'bg-emerald-500'
    return 'bg-gray-500'
  }

  const getStatusText = () => {
    if (connectionError) return 'Error'
    if (isConnecting) return 'Connecting...'
    if (isConnected) return 'Connected'
    return 'Disconnected'
  }

  const getOrchestratorBadge = () => {
    switch (orchestratorState) {
      case 'LISTENING':
        return <Badge variant="outline" className="border-blue-500/30 text-blue-400">Listening</Badge>
      case 'CANDIDATE':
        return <Badge variant="outline" className="border-amber-500/30 text-amber-400 animate-pulse">Question Detected</Badge>
      case 'STREAMING_T0':
        return <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Answering</Badge>
      case 'REFINE_T1':
        return <Badge variant="outline" className="border-purple-500/30 text-purple-400">Refining</Badge>
      case 'DONE':
        return <Badge variant="outline" className="border-gray-500/30 text-gray-400">Done</Badge>
      default:
        return null
    }
  }

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 bg-gray-900/95 border-b border-gray-800 backdrop-blur-sm', className)}>
      {/* Left section - Listening controls */}
      <div className="flex items-center gap-2">
        {/* Listen button */}
        <Button
          onClick={handleListeningToggle}
          variant={isListening ? 'destructive' : 'default'}
          size="sm"
          className={cn(
            'relative gap-2 min-w-[120px]',
            isListening && !isPaused && 'bg-emerald-600 hover:bg-emerald-700'
          )}
          disabled={!isConnected || isConnecting}
        >
          {isListening ? (
            <>
              <Mic className="w-4 h-4" />
              {isPaused ? 'Paused' : 'Listening'}
            </>
          ) : (
            <>
              <MicOff className="w-4 h-4" />
              Start
            </>
          )}

          {/* Audio level indicator */}
          {isListening && !isPaused && (
            <motion.div
              className="absolute -bottom-1 left-0 right-0 h-1 bg-emerald-500/30 rounded-full overflow-hidden"
              initial={false}
            >
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${audioLevel * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </motion.div>
          )}
        </Button>

        {/* Pause button */}
        {isListening && (
          <Button
            onClick={togglePause}
            variant={isPaused ? 'default' : 'secondary'}
            size="sm"
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Radio className="w-4 h-4" />
                Resume
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Pause
              </>
            )}
          </Button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Center section - Response style & Auto-answer */}
      <div className="flex items-center gap-3">
        {/* Response style selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-400">Style:</Label>
          <Select value={responseStyle} onValueChange={handleStyleChange}>
            <SelectTrigger className="w-[130px] h-8 bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {RESPONSE_STYLES.map((style) => (
                <SelectItem
                  key={style.value}
                  value={style.value}
                  className="focus:bg-gray-700"
                >
                  <div className="flex flex-col">
                    <span>{style.label}</span>
                    <span className="text-xs text-gray-500">{style.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom prompt (shown when custom style is selected) */}
        {responseStyle === 'custom' && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
          >
            <Textarea
              value={customStylePrompt}
              onChange={(e) => setCustomStylePrompt(e.target.value)}
              placeholder="Enter custom style prompt..."
              className="w-48 h-8 min-h-0 bg-gray-800 border-gray-700 text-sm resize-none"
            />
          </motion.div>
        )}

        {/* Auto-answer toggle */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-400">Auto-answer:</Label>
          <Switch
            checked={autoAnswer}
            onCheckedChange={setAutoAnswer}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Transport selector */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-400">Transport:</Label>
        <Select
          value={transport}
          onValueChange={(v) => setTransport(v as TransportType)}
        >
          <SelectTrigger className="w-[80px] h-8 bg-gray-800 border-gray-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="websocket">WS</SelectItem>
            <SelectItem value="sse">SSE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Cancel answer button */}
      {currentAnswer && (
        <Button
          onClick={onCancelAnswer}
          variant="destructive"
          size="sm"
          className="gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section - Status & info */}
      <div className="flex items-center gap-3">
        {/* Orchestrator state badge */}
        {getOrchestratorBadge()}

        {/* Connection status */}
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', getStatusColor())} />
          <span className="text-xs text-gray-400">{getStatusText()}</span>
        </div>

        {/* Keyboard shortcuts */}
        <DropdownMenu open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Keyboard className="w-4 h-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-gray-800 border-gray-700">
            <div className="p-2">
              <h4 className="text-xs font-medium text-gray-300 mb-2">Keyboard Shortcuts</h4>
              <div className="space-y-1">
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{shortcut.description}</span>
                    <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-300">
                      {shortcut.key}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Error indicator */}
        {connectionError && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-gray-800 border-gray-700">
              <div className="p-3">
                <h4 className="text-sm font-medium text-red-400 mb-1">Connection Error</h4>
                <p className="text-xs text-gray-400">{connectionError}</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
