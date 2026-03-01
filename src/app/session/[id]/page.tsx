'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TranscriptPanel } from '@/components/session/transcript-panel'
import { AnswerPanel } from '@/components/session/answer-panel'
import { TopControlsBar } from '@/components/session/top-controls-bar'
import { useSessionStore } from '@/stores/session-store'
import { useSessionSocket } from '@/hooks/use-session-socket'
import { useAudioCapture } from '@/hooks/use-audio-capture'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false)
  const hasSimulatedRef = useRef(false)

  const {
    setSessionId,
    isListening,
    setIsListening,
    isConnected,
    setResponseStyle
  } = useSessionStore()

  // Set session ID on mount
  useEffect(() => {
    setSessionId(sessionId)
    return () => setSessionId(null)
  }, [sessionId, setSessionId])

  // WebSocket connection
  const {
    connect,
    disconnect,
    sendSttPartial,
    sendSttFinal,
    cancelCurrentAnswer,
    forceAnswer,
    updateStyle
  } = useSessionSocket({
    sessionId,
    autoConnect: true
  })

  // Audio capture
  const {
    isCapturing,
    audioLevel,
    startCapture,
    stopCapture,
    simulateStt,
    simulateFinalStt
  } = useAudioCapture({
    onPartialTranscript: (text, confidence, seq) => {
      sendSttPartial(text, confidence, seq)
    },
    onFinalTranscript: (text, confidence, seq) => {
      sendSttFinal(text, confidence, seq)
    }
  })

  // Start/stop listening
  const handleStartListening = useCallback(() => {
    setIsListening(true)
    startCapture()
  }, [setIsListening, startCapture])

  const handleStopListening = useCallback(() => {
    setIsListening(false)
    stopCapture()
  }, [setIsListening, stopCapture])

  // Cancel answer
  const handleCancelAnswer = useCallback(() => {
    cancelCurrentAnswer()
  }, [cancelCurrentAnswer])

  // Force answer
  const handleForceAnswer = useCallback(() => {
    const lastTranscript = useSessionStore.getState().transcripts
      .filter(t => t.source === 'final')
      .pop()

    if (lastTranscript) {
      forceAnswer(lastTranscript.text)
    }
  }, [forceAnswer])

  // Toggle style menu
  const handleToggleStyleMenu = useCallback(() => {
    setIsStyleMenuOpen(prev => !prev)
  }, [])

  // Keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    onPauseResume: () => {
      if (isListening) {
        useSessionStore.getState().togglePause()
      }
    },
    onCancelAnswer: handleCancelAnswer,
    onForceAnswer: handleForceAnswer,
    onToggleStyleMenu: handleToggleStyleMenu,
    enabled: true
  })

  // Demo: Simulate some transcripts for testing
  useEffect(() => {
    if (isConnected && !hasSimulatedRef.current) {
      hasSimulatedRef.current = true

      // Simulate some demo transcripts after a delay
      const timeout1 = setTimeout(() => {
        simulateStt('Hello, I am starting the meeting now...', 0.92, 1)
      }, 2000)

      const timeout2 = setTimeout(() => {
        simulateFinalStt('Hello, I am starting the meeting now.', 0.95, 2)
      }, 3000)

      const timeout3 = setTimeout(() => {
        simulateStt('Can you tell me about your experience with React?', 0.88, 3)
      }, 5000)

      const timeout4 = setTimeout(() => {
        simulateFinalStt('Can you tell me about your experience with React?', 0.94, 4)
      }, 6000)

      return () => {
        clearTimeout(timeout1)
        clearTimeout(timeout2)
        clearTimeout(timeout3)
        clearTimeout(timeout4)
      }
    }
  }, [isConnected, simulateStt, simulateFinalStt])

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top controls bar */}
      <TopControlsBar
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        onCancelAnswer={handleCancelAnswer}
        audioLevel={audioLevel}
        shortcuts={shortcuts}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left panel - Transcript */}
          <ResizablePanel
            defaultSize={50}
            minSize={30}
            className="bg-gray-900/50"
          >
            <TranscriptPanel />
          </ResizablePanel>

          {/* Resizable handle */}
          <ResizableHandle withHandle className="bg-gray-800 hover:bg-gray-700 transition-colors" />

          {/* Right panel - Assistant answers */}
          <ResizablePanel
            defaultSize={50}
            minSize={30}
            className="bg-gray-900/30"
          >
            <AnswerPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom status bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-t border-gray-800 text-xs text-gray-500"
      >
        <div className="flex items-center gap-4">
          <span>Session: {sessionId.slice(0, 8)}...</span>
          {isCapturing && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Recording
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Press Space to pause/resume</span>
          <span>Esc to cancel</span>
        </div>
      </motion.div>
    </div>
  )
}
