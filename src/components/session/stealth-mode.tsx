'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useSessionStore } from '@/stores/session-store'
import { cn } from '@/lib/utils'
import {
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  GripVertical,
  X,
  MessageSquare,
  Mic,
  Sparkles
} from 'lucide-react'

interface StealthModeProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
}

interface Position {
  x: number
  y: number
}

export function StealthMode({ isOpen, onClose, onToggle }: StealthModeProps) {
  const {
    transcripts,
    partialTranscript,
    currentAnswer,
    answerHistory,
    isListening,
    orchestratorState,
    detectedQuestion
  } = useSessionStore()

  const [isMinimized, setIsMinimized] = useState(false)
  const [hideContent, setHideContent] = useState(false)
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Handle keyboard shortcut Ctrl+Shift+O
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault()
        onToggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggle])

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[data-no-drag]')) {
      return
    }
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    }
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 320, dragRef.current.startPosX + deltaX)),
      y: Math.max(0, Math.min(window.innerHeight - 200, dragRef.current.startPosY + deltaY))
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragRef.current = null
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Get latest transcript
  const latestTranscript = transcripts[transcripts.length - 1]
  const latestAnswer = currentAnswer || answerHistory[answerHistory.length - 1]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999
        }}
        className={cn(
          'bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden',
          isDragging && 'cursor-grabbing',
          isMinimized ? 'w-64' : 'w-80'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Header - Draggable */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border-b border-gray-700/30 cursor-grab">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-300">Stealth Mode</span>
            {isListening && (
              <Badge variant="outline" className="h-5 text-[10px] border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1" data-no-drag>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Content - Collapsible */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Hide Content Toggle */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/30" data-no-drag>
                <div className="flex items-center gap-2">
                  {hideContent ? (
                    <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-xs text-gray-400">Hide content</span>
                </div>
                <Switch
                  checked={hideContent}
                  onCheckedChange={setHideContent}
                  className="h-4 w-7 data-[state=checked]:bg-violet-600"
                />
              </div>

              {/* Main Content */}
              <ScrollArea className="h-64">
                <div className="p-3 space-y-3">
                  {/* Question Detection */}
                  {detectedQuestion && orchestratorState !== 'LISTENING' && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-medium text-amber-500">Question Detected</span>
                      </div>
                      <p className={cn(
                        "text-xs",
                        hideContent ? "blur-sm select-none" : "text-gray-300"
                      )}>
                        &ldquo;{detectedQuestion.span}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Latest Transcript */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Mic className="w-3 h-3 text-gray-500" />
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Transcript</span>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-800/50 border border-gray-700/30">
                      {partialTranscript ? (
                        <p className={cn(
                          "text-xs italic text-gray-400",
                          hideContent && "blur-sm select-none"
                        )}>
                          {partialTranscript}
                        </p>
                      ) : latestTranscript ? (
                        <p className={cn(
                          "text-xs",
                          latestTranscript.source === 'partial' ? "text-gray-400 italic" : "text-gray-200"
                        )}>
                          {latestTranscript.text}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No transcript yet...</p>
                      )}
                    </div>
                  </div>

                  {/* Latest Answer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-gray-500" />
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Answer</span>
                      {currentAnswer?.isStreaming && (
                        <Badge variant="outline" className="h-4 text-[10px] border-emerald-500/50 text-emerald-400 animate-pulse">
                          Streaming
                        </Badge>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      {latestAnswer ? (
                        <>
                          {latestAnswer.question && (
                            <p className={cn(
                              "text-[10px] text-gray-500 mb-1.5 pb-1.5 border-b border-gray-700/30",
                              hideContent && "blur-sm select-none"
                            )}>
                              Q: {latestAnswer.question}
                            </p>
                          )}
                          <p className={cn(
                            "text-xs leading-relaxed",
                            hideContent ? "blur-sm select-none" : "text-gray-200"
                          )}>
                            {latestAnswer.answer || 'Waiting for response...'}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No answer yet...</p>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Status Bar */}
              <div className="px-3 py-2 border-t border-gray-700/30 bg-gray-800/30">
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>State: {orchestratorState}</span>
                  <span>Ctrl+Shift+O to toggle</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimized Status */}
        {isMinimized && (
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isListening ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-500" />
              )}
              <span className="text-xs text-gray-400">
                {transcripts.length} turns • {answerHistory.length} answers
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// Hook to use stealth mode
export function useStealthMode() {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    toggle,
    open,
    close
  }
}
