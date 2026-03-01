// Azure Speech-to-Text Service for Streaming Transcription
// This service handles real-time audio streaming to Azure STT

import { EventEmitter } from 'events';

export interface AzureSTTConfig {
  subscriptionKey: string;
  region: string;
  language?: string;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  offset?: number;
  duration?: number;
}

export class AzureSTTService extends EventEmitter {
  private config: AzureSTTConfig;
  private isRunning: boolean = false;

  constructor(config: AzureSTTConfig) {
    super();
    this.config = {
      language: 'en-US',
      ...config
    };
  }

  // Get auth token for Azure STT
  private async getAuthToken(): Promise<string> {
    const response = await fetch(
      `https://${this.config.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Azure STT token: ${response.statusText}`);
    }

    return response.text();
  }

  // Start streaming transcription
  async startStreaming(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('started');
  }

  // Process audio chunk
  async processAudioChunk(audioData: ArrayBuffer): Promise<void> {
    if (!this.isRunning) return;
    
    // In a real implementation, this would send audio to Azure STT WebSocket
    // For now, we emit that audio was received
    this.emit('audioReceived', { size: audioData.byteLength });
  }

  // Stop streaming
  stopStreaming(): void {
    this.isRunning = false;
    this.emit('stopped');
  }

  // Get WebSocket URL for Azure STT
  getWebSocketUrl(): string {
    return `wss://${this.config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${this.config.language}`;
  }

  // Create Speech SDK configuration
  getSpeechConfig(): object {
    return {
      subscriptionKey: this.config.subscriptionKey,
      region: this.config.region,
      language: this.config.language
    };
  }
}

// Factory function to create Azure STT service
export function createAzureSTTService(config: AzureSTTConfig): AzureSTTService {
  return new AzureSTTService(config);
}

// Browser-side STT using Web Speech API as fallback
export interface BrowserSTTOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (result: TranscriptionResult) => void;
  onError?: (error: string) => void;
}

export function createBrowserSTT(options: BrowserSTTOptions = {}): {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
} {
  const SpeechRecognition = (window as any).SpeechRecognition || 
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return {
      start: () => {},
      stop: () => {},
      isSupported: false
    };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = options.language || 'en-US';
  recognition.continuous = options.continuous ?? true;
  recognition.interimResults = options.interimResults ?? true;

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      options.onResult?.({
        text: transcript,
        isFinal,
        confidence
      });
    }
  };

  recognition.onerror = (event: any) => {
    options.onError?.(event.error);
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    isSupported: true
  };
}
