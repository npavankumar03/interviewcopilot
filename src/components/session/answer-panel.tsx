'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSessionStore, type AnswerEntry } from '@/stores/session-store'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Sparkles, Clock } from 'lucide-react'

interface AnswerPanelProps {
  className?: string
}

// Typewriter effect component for streaming text
function TypewriterText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [streamedText, setStreamedText] = useState('')
  const lastProcessedLengthRef = useRef(0)
  const lastStreamingStateRef = useRef(isStreaming)

  // Reset when streaming state changes from true to false
  // Use a separate effect to handle streaming state changes
  const handleReset = useCallback(() => {
    setStreamedText('')
    lastProcessedLengthRef.current = 0
  }, [])

  // Track streaming state changes
  useEffect(() => {
    const wasStreaming = lastStreamingStateRef.current
    lastStreamingStateRef.current = isStreaming

    // Reset when transitioning from streaming to not streaming
    if (wasStreaming && !isStreaming) {
      handleReset()
    }
  }, [isStreaming, handleReset])

  // Typewriter effect - process text in chunks
  useEffect(() => {
    if (!isStreaming) return

    // Check for new text
    const newLength = text.length
    const prevLength = streamedText.length

    if (newLength > prevLength) {
      // Add new characters with a slight delay for typewriter effect
      const newText = text.slice(prevLength)
      const charsToAdd = newText.length

      // Add characters one at a time with delay
      let charIndex = 0
      const addChar = () => {
        if (charIndex < charsToAdd) {
          setStreamedText(prev => prev + newText[charIndex])
          charIndex++
          setTimeout(addChar, 30 + Math.random() * 40)
        }
      }
      addChar()
    }
  }, [text, isStreaming, streamedText.length])

  // For non-streaming, show all text immediately
  const displayText = isStreaming ? streamedText : text

  return (
    <span>
      {displayText}
      {isStreaming && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-0.5 h-4 bg-emerald-500 ml-0.5"
        />
      )}
    </span>
  )
}

// Question detection banner
function QuestionBanner() {
  const { detectedQuestion, orchestratorState } = useSessionStore()

  if (!detectedQuestion || orchestratorState === 'LISTENING') {
    return null
  }

  const confidencePercent = Math.round(detectedQuestion.confidence * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-500">Question Detected</span>
        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
          {confidencePercent}% confidence
        </Badge>
      </div>
      <p className="text-sm text-gray-300 italic">&ldquo;{detectedQuestion.span}&rdquo;</p>
      {detectedQuestion.kind === 'partial' && (
        <p className="text-xs text-gray-500 mt-1">Waiting for complete question...</p>
      )}
    </motion.div>
  )
}

// Current answer display
function CurrentAnswer() {
  const { currentAnswer } = useSessionStore()

  if (!currentAnswer) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-400">Answer</span>
        {currentAnswer.isStreaming && (
          <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 animate-pulse">
            Streaming
          </Badge>
        )}
      </div>

      <div className="mb-3 p-3 rounded bg-gray-800/50 border border-gray-700">
        <p className="text-xs text-gray-500 mb-1">Question:</p>
        <p className="text-sm text-gray-300">{currentAnswer.question}</p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none">
        <TypewriterText text={currentAnswer.answer} isStreaming={currentAnswer.isStreaming} />
      </div>
    </motion.div>
  )
}

// Answer history item
function AnswerHistoryItem({ entry }: { entry: AnswerEntry }) {
  const timestamp = new Date(entry.timestamp)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
    >
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-3 h-3 text-gray-500" />
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(timestamp, { addSuffix: false })}
        </span>
      </div>

      <div className="mb-2 p-2 rounded bg-gray-900/50 border border-gray-800">
        <p className="text-xs text-gray-500 mb-1">Q:</p>
        <p className="text-sm text-gray-400">{entry.question}</p>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed">{entry.answer}</p>
    </motion.div>
  )
}

export function AnswerPanel({ className }: AnswerPanelProps) {
  const { answerHistory, currentAnswer } = useSessionStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentAnswer?.answer, answerHistory.length])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Assistant</h2>
        <span className="text-xs text-gray-500">{answerHistory.length} answers</span>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4">
          <AnimatePresence mode="sync">
            {/* Show empty state */}
            {!currentAnswer && answerHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <MessageSquare className="w-12 h-12 mb-4 text-gray-600" />
                <p className="text-sm">Ask a question to get answers</p>
                <p className="text-xs text-gray-600 mt-1">Answers will appear here</p>
              </div>
            )}

            {/* Answer history */}
            {answerHistory.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                  History
                </h3>
                {answerHistory.map((entry) => (
                  <AnswerHistoryItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}

            {/* Question detection banner */}
            <QuestionBanner />

            {/* Current streaming answer */}
            <CurrentAnswer />
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
