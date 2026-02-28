'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useSessionStore } from '@/stores/session-store'

interface UseAudioCaptureOptions {
  onPartialTranscript?: (text: string, confidence: number, seq: number) => void
  onFinalTranscript?: (text: string, confidence: number, seq: number) => void
  sampleRate?: number
}

// Audio buffer for accumulating speech
class AudioBuffer {
  private buffer: Int16Array[] = []
  private totalLength = 0

  append(data: Int16Array) {
    this.buffer.push(data)
    this.totalLength += data.length
  }

  getCombined(): Int16Array {
    const combined = new Int16Array(this.totalLength)
    let offset = 0
    for (const chunk of this.buffer) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    return combined
  }

  clear() {
    this.buffer = []
    this.totalLength = 0
  }

  get length() {
    return this.totalLength
  }
}

export function useAudioCapture({
  onPartialTranscript,
  onFinalTranscript,
  sampleRate = 16000
}: UseAudioCaptureOptions = {}) {
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioBufferRef = useRef<AudioBuffer>(new AudioBuffer())
  const seqRef = useRef(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const { isPaused } = useSessionStore()

  // Convert Float32 to Int16 (PCM16)
  const float32ToInt16 = useCallback((float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16Array
  }, [])

  // Process audio chunk - simulate STT for demo
  const processAudioChunk = useCallback((pcmData: Int16Array, isFinal: boolean = false) => {
    // In a real implementation, you would send this to a speech-to-text service
    // For demo purposes, we'll just track the audio activity
    seqRef.current++
  }, [])

  // Start capturing audio
  const startCapture = useCallback(async () => {
    try {
      setError(null)

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      mediaStreamRef.current = stream

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate
      })
      audioContextRef.current = audioContext

      // Create analyser for audio level visualization
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Create script processor for audio processing
      const bufferSize = 4096
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      // Connect nodes
      source.connect(analyser)
      source.connect(processor)
      processor.connect(audioContext.destination)

      // Handle audio processing
      processor.onaudioprocess = (event) => {
        if (isPaused) return

        const inputData = event.inputBuffer.getChannelData(0)
        const pcmData = float32ToInt16(inputData)

        // Add to buffer
        audioBufferRef.current.append(pcmData)

        // Process every ~100ms of audio (1600 samples at 16kHz)
        if (audioBufferRef.current.length >= sampleRate / 10) {
          const chunk = audioBufferRef.current.getCombined()
          processAudioChunk(chunk, false)
          audioBufferRef.current.clear()
        }
      }

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current && !isPaused) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setAudioLevel(average / 255) // Normalize to 0-1
        }
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      updateAudioLevel()

      setIsCapturing(true)
      seqRef.current = 0
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start audio capture'
      setError(errorMessage)
      console.error('Audio capture error:', err)
    }
  }, [sampleRate, isPaused, float32ToInt16, processAudioChunk])

  // Stop capturing audio
  const stopCapture = useCallback(() => {
    // Process remaining audio
    if (audioBufferRef.current.length > 0) {
      const chunk = audioBufferRef.current.getCombined()
      processAudioChunk(chunk, true)
      audioBufferRef.current.clear()
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Disconnect and cleanup
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    analyserRef.current = null
    setIsCapturing(false)
    setAudioLevel(0)
  }, [processAudioChunk])

  // Simulate STT for demo purposes
  const simulateStt = useCallback((text: string) => {
    const seq = seqRef.current++
    const confidence = 0.85 + Math.random() * 0.15

    if (onPartialTranscript) {
      onPartialTranscript(text, confidence, seq)
    }
  }, [onPartialTranscript])

  // Simulate final STT
  const simulateFinalStt = useCallback((text: string) => {
    const seq = seqRef.current++
    const confidence = 0.9 + Math.random() * 0.1

    if (onFinalTranscript) {
      onFinalTranscript(text, confidence, seq)
    }
  }, [onFinalTranscript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture()
    }
  }, [stopCapture])

  return {
    isCapturing,
    error,
    audioLevel,
    startCapture,
    stopCapture,
    simulateStt,
    simulateFinalStt
  }
}
