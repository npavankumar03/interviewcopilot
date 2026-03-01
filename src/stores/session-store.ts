import { create } from 'zustand'

// Response style types
export type ResponseStyle = 'short' | 'star' | 'detailed' | 'technical' | 'custom'

// Transport type
export type TransportType = 'websocket' | 'sse'

// Transcript entry
export interface TranscriptEntry {
  id: string
  text: string
  source: 'partial' | 'final'
  confidence?: number
  seq: number
  timestamp: number
}

// Question detection
export interface DetectedQuestion {
  span: string
  confidence: number
  kind: 'partial' | 'final'
}

// Answer history entry
export interface AnswerEntry {
  id: string
  requestId: string
  question: string
  answer: string
  timestamp: number
  isStreaming: boolean
}

// Session state
export interface SessionState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  transport: TransportType

  // Session info
  sessionId: string | null
  sessionStatus: 'idle' | 'active' | 'ended'
  orchestratorState: 'LISTENING' | 'CANDIDATE' | 'STREAMING_T0' | 'REFINE_T1' | 'DONE'

  // Listening state
  isListening: boolean
  isPaused: boolean

  // Response settings
  responseStyle: ResponseStyle
  customStylePrompt: string
  autoAnswer: boolean

  // Transcript
  transcripts: TranscriptEntry[]
  partialTranscript: string

  // Question detection
  detectedQuestion: DetectedQuestion | null

  // Current answer streaming
  currentAnswer: AnswerEntry | null
  answerHistory: AnswerEntry[]

  // Actions
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setConnectionError: (error: string | null) => void
  setTransport: (transport: TransportType) => void

  setSessionId: (id: string | null) => void
  setSessionStatus: (status: 'idle' | 'active' | 'ended') => void
  setOrchestratorState: (state: 'LISTENING' | 'CANDIDATE' | 'STREAMING_T0' | 'REFINE_T1' | 'DONE') => void

  setIsListening: (listening: boolean) => void
  setIsPaused: (paused: boolean) => void
  toggleListening: () => void
  togglePause: () => void

  setResponseStyle: (style: ResponseStyle) => void
  setCustomStylePrompt: (prompt: string) => void
  setAutoAnswer: (auto: boolean) => void

  addTranscript: (entry: TranscriptEntry) => void
  setPartialTranscript: (text: string) => void
  clearTranscripts: () => void

  setDetectedQuestion: (question: DetectedQuestion | null) => void

  startAnswer: (requestId: string, question: string) => void
  appendAnswerChunk: (chunk: string) => void
  endAnswer: () => void
  cancelAnswer: () => void

  reset: () => void
}

const initialState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  transport: 'websocket' as TransportType,

  sessionId: null,
  sessionStatus: 'idle' as const,
  orchestratorState: 'LISTENING' as const,

  isListening: false,
  isPaused: false,

  responseStyle: 'short' as ResponseStyle,
  customStylePrompt: '',
  autoAnswer: true,

  transcripts: [] as TranscriptEntry[],
  partialTranscript: '',

  detectedQuestion: null as DetectedQuestion | null,

  currentAnswer: null as AnswerEntry | null,
  answerHistory: [] as AnswerEntry[],
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  // Connection actions
  setConnected: (connected) => set({ isConnected: connected, isConnecting: false }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setConnectionError: (error) => set({ connectionError: error, isConnecting: false }),
  setTransport: (transport) => set({ transport }),

  // Session actions
  setSessionId: (id) => set({ sessionId: id }),
  setSessionStatus: (status) => set({ sessionStatus: status }),
  setOrchestratorState: (state) => set({ orchestratorState: state }),

  // Listening actions
  setIsListening: (listening) => set({ isListening: listening, isPaused: false }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  toggleListening: () => {
    const { isListening, isPaused } = get()
    if (isListening && !isPaused) {
      set({ isListening: false, isPaused: false })
    } else {
      set({ isListening: true, isPaused: false })
    }
  },
  togglePause: () => {
    const { isListening, isPaused } = get()
    if (isListening) {
      set({ isPaused: !isPaused })
    }
  },

  // Response settings
  setResponseStyle: (style) => set({ responseStyle: style }),
  setCustomStylePrompt: (prompt) => set({ customStylePrompt: prompt }),
  setAutoAnswer: (auto) => set({ autoAnswer: auto }),

  // Transcript actions
  addTranscript: (entry) => set((state) => ({
    transcripts: [...state.transcripts, entry],
    partialTranscript: entry.source === 'final' ? '' : state.partialTranscript
  })),
  setPartialTranscript: (text) => set({ partialTranscript: text }),
  clearTranscripts: () => set({ transcripts: [], partialTranscript: '' }),

  // Question detection
  setDetectedQuestion: (question) => set({ detectedQuestion: question }),

  // Answer actions
  startAnswer: (requestId, question) => set({
    currentAnswer: {
      id: requestId,
      requestId,
      question,
      answer: '',
      timestamp: Date.now(),
      isStreaming: true
    }
  }),
  appendAnswerChunk: (chunk) => set((state) => {
    if (!state.currentAnswer) return state
    return {
      currentAnswer: {
        ...state.currentAnswer,
        answer: state.currentAnswer.answer + chunk
      }
    }
  }),
  endAnswer: () => set((state) => {
    if (!state.currentAnswer) return state
    return {
      currentAnswer: null,
      answerHistory: [...state.answerHistory, { ...state.currentAnswer, isStreaming: false }]
    }
  }),
  cancelAnswer: () => set({ currentAnswer: null }),

  // Reset
  reset: () => set(initialState)
}))
