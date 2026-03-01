'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSessionStore, type ResponseStyle } from '@/stores/session-store'

// Message types
interface ServerMessage {
  type: string
  sessionId?: string
  requestId?: string
  question?: string
  text?: string
  span?: string
  confidence?: number
  kind?: 'partial' | 'final'
  reason?: string
  message?: string
  state?: string
  responseStyle?: string
}

interface UseSessionSocketOptions {
  sessionId: string
  token?: string
  autoConnect?: boolean
}

export function useSessionSocket({ sessionId, token, autoConnect = true }: UseSessionSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const {
    setConnected,
    setConnecting,
    setConnectionError,
    setOrchestratorState,
    setSessionStatus,
    responseStyle,
    customStylePrompt,
    autoAnswer,
    addTranscript,
    setPartialTranscript,
    setDetectedQuestion,
    startAnswer,
    appendAnswerChunk,
    endAnswer,
    cancelAnswer
  } = useSessionStore()

  // Generate unique ID
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Handle incoming messages
  const handleMessage = useCallback((data: ServerMessage) => {
    switch (data.type) {
      case 'connected':
        console.log('Socket connected:', data)
        break

      case 'session_joined':
        setSessionStatus('active')
        if (data.state) {
          setOrchestratorState(data.state as 'LISTENING' | 'CANDIDATE' | 'STREAMING_T0' | 'REFINE_T1' | 'DONE')
        }
        console.log('Session joined:', data.sessionId)
        break

      case 'session_left':
        setSessionStatus('idle')
        break

      case 'assistant_start':
        if (data.requestId && data.question) {
          startAnswer(data.requestId, data.question)
          setOrchestratorState('STREAMING_T0')
        }
        break

      case 'assistant_chunk':
        if (data.text) {
          appendAnswerChunk(data.text)
        }
        break

      case 'assistant_end':
        endAnswer()
        setOrchestratorState('DONE')
        setTimeout(() => setOrchestratorState('LISTENING'), 500)
        break

      case 'detected_question':
        if (data.span && data.confidence !== undefined && data.kind) {
          setDetectedQuestion({
            span: data.span,
            confidence: data.confidence,
            kind: data.kind
          })
          setOrchestratorState('CANDIDATE')
        }
        break

      case 'suppressed':
        console.log('Answer suppressed:', data.reason, data.span)
        setOrchestratorState('LISTENING')
        break

      case 'answer_cancelled':
        cancelAnswer()
        setOrchestratorState('LISTENING')
        break

      case 'style_updated':
        console.log('Style updated:', data.responseStyle)
        break

      case 'error':
        setConnectionError(data.message || 'Unknown error')
        console.error('Server error:', data.message)
        break

      default:
        console.log('Unknown message type:', data.type)
    }
  }, [
    setSessionStatus,
    setOrchestratorState,
    startAnswer,
    appendAnswerChunk,
    endAnswer,
    setDetectedQuestion,
    cancelAnswer,
    setConnectionError
  ])

  // Connect to socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    setConnecting(true)
    setConnectionError(null)

    // Create socket connection with XTransformPort
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token: token || ''
      }
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected')
      setConnected(true)
      setConnecting(false)
      reconnectAttemptsRef.current = 0

      // Join session
      socket.emit('message', {
        type: 'session_join',
        sessionId
      })
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setConnected(false)

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect()
      }
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message)
      reconnectAttemptsRef.current++

      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionError('Failed to connect after multiple attempts')
        setConnecting(false)
      }
    })

    socket.on('message', handleMessage)

    socket.on('error', (error) => {
      console.error('Socket error:', error)
      setConnectionError(error.message || 'Socket error')
    })
  }, [sessionId, token, setConnected, setConnecting, setConnectionError, handleMessage])

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('message', {
        type: 'session_leave',
        sessionId
      })
      socketRef.current.disconnect()
      socketRef.current = null
      setConnected(false)
      setSessionStatus('idle')
    }
  }, [sessionId, setConnected, setSessionStatus])

  // Send STT partial
  const sendSttPartial = useCallback((text: string, confidence: number, seq: number) => {
    if (!socketRef.current?.connected) return

    // Add partial transcript to local state
    addTranscript({
      id: generateId(),
      text,
      source: 'partial',
      confidence,
      seq,
      timestamp: Date.now()
    })

    // Only send to server if auto-answer is enabled
    if (autoAnswer) {
      socketRef.current.emit('message', {
        type: 'stt_partial',
        sessionId,
        text,
        sttConfidence: confidence,
        seq
      })
    }
  }, [sessionId, autoAnswer, addTranscript, generateId])

  // Send STT final
  const sendSttFinal = useCallback((text: string, confidence: number, seq: number) => {
    if (!socketRef.current?.connected) return

    // Add final transcript to local state
    addTranscript({
      id: generateId(),
      text,
      source: 'final',
      confidence,
      seq,
      timestamp: Date.now()
    })

    // Only send to server if auto-answer is enabled
    if (autoAnswer) {
      socketRef.current.emit('message', {
        type: 'stt_final',
        sessionId,
        text,
        sttConfidence: confidence,
        seq
      })
    }
  }, [sessionId, autoAnswer, addTranscript, generateId])

  // Cancel answer
  const cancelCurrentAnswer = useCallback(() => {
    if (!socketRef.current?.connected) return

    socketRef.current.emit('message', {
      type: 'answer_cancel',
      sessionId
    })
  }, [sessionId])

  // Force answer now
  const forceAnswer = useCallback((text: string) => {
    if (!socketRef.current?.connected) return

    socketRef.current.emit('message', {
      type: 'manual_answer',
      sessionId,
      text
    })
  }, [sessionId])

  // Update response style
  const updateStyle = useCallback((style: ResponseStyle, customPrompt?: string) => {
    if (!socketRef.current?.connected) return

    socketRef.current.emit('message', {
      type: 'update_style',
      sessionId,
      responseStyle: style,
      customStylePrompt: customPrompt || null
    })
  }, [sessionId])

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    connect,
    disconnect,
    sendSttPartial,
    sendSttFinal,
    cancelCurrentAnswer,
    forceAnswer,
    updateStyle,
  }
}
