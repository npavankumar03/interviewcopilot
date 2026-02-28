'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useSessionStore, type TranscriptEntry } from '@/stores/session-store'
import { formatDistanceToNow } from 'date-fns'

interface TranscriptPanelProps {
  className?: string
}

function TranscriptItem({ entry, isNew }: { entry: TranscriptEntry; isNew: boolean }) {
  const isPartial = entry.source === 'partial'
  const timestamp = new Date(entry.timestamp)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'mb-2 p-3 rounded-lg transition-all duration-300',
        isPartial
          ? 'bg-gray-800/50 border border-gray-700/50'
          : 'bg-gray-800/80 border border-gray-600/50',
        isNew && !isPartial && 'ring-1 ring-emerald-500/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-sm leading-relaxed flex-1',
            isPartial ? 'text-gray-400 italic' : 'text-gray-100'
          )}
        >
          {entry.text}
        </p>
        {entry.confidence && (
          <span className="text-xs text-gray-500 shrink-0">
            {Math.round(entry.confidence * 100)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(timestamp, { addSuffix: false })}
        </span>
        {isPartial && (
          <span className="text-xs text-gray-500 animate-pulse">listening...</span>
        )}
      </div>
    </motion.div>
  )
}

export function TranscriptPanel({ className }: TranscriptPanelProps) {
  const { transcripts, partialTranscript } = useSessionStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)

  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (scrollRef.current && transcripts.length > prevLengthRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevLengthRef.current = transcripts.length
  }, [transcripts.length])

  // Group transcripts by time (every 5 minutes)
  const groupedTranscripts = transcripts.reduce((groups, entry, index) => {
    const isNew = index === transcripts.length - 1 && entry.source === 'final'
    const item = { entry, isNew }
    return [...groups, item]
  }, [] as { entry: TranscriptEntry; isNew: boolean }[])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Live Transcript</h2>
        <span className="text-xs text-gray-500">{transcripts.length} entries</span>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4">
          <AnimatePresence mode="popLayout">
            {groupedTranscripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <svg
                  className="w-12 h-12 mb-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <p className="text-sm">Start speaking to see transcripts</p>
              </div>
            ) : (
              groupedTranscripts.map((item) => (
                <TranscriptItem
                  key={item.entry.id}
                  entry={item.entry}
                  isNew={item.isNew}
                />
              ))
            )}
          </AnimatePresence>

          {/* Show current partial text */}
          {partialTranscript && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 border-dashed"
            >
              <p className="text-sm text-gray-400 italic">{partialTranscript}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-500">Speaking...</span>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
