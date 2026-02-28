// WebSocket message types

// Client -> Server messages
export interface ClientMessage {
  type: string;
  sessionId?: string;
  text?: string;
  sttConfidence?: number;
  seq?: number;
  token?: string;
}

export interface HelloMessage extends ClientMessage {
  type: 'hello';
  token: string;
}

export interface SessionJoinMessage extends ClientMessage {
  type: 'session_join';
  sessionId: string;
}

export interface SttPartialMessage extends ClientMessage {
  type: 'stt_partial';
  sessionId: string;
  text: string;
  sttConfidence?: number;
  seq: number;
}

export interface SttFinalMessage extends ClientMessage {
  type: 'stt_final';
  sessionId: string;
  text: string;
  sttConfidence?: number;
  seq: number;
}

export interface AnswerCancelMessage extends ClientMessage {
  type: 'answer_cancel';
  sessionId: string;
}

export interface ManualAnswerMessage extends ClientMessage {
  type: 'manual_answer';
  sessionId: string;
  text: string;
}

// Server -> Client messages
export interface ServerMessage {
  type: string;
  sessionId?: string;
  requestId?: string;
  question?: string;
  text?: string;
  span?: string;
  confidence?: number;
  kind?: string;
  reason?: string;
  message?: string;
}

export interface AssistantStartMessage extends ServerMessage {
  type: 'assistant_start';
  sessionId: string;
  requestId: string;
  question: string;
}

export interface AssistantChunkMessage extends ServerMessage {
  type: 'assistant_chunk';
  sessionId: string;
  requestId: string;
  text: string;
}

export interface AssistantEndMessage extends ServerMessage {
  type: 'assistant_end';
  sessionId: string;
  requestId: string;
}

export interface DetectedQuestionMessage extends ServerMessage {
  type: 'detected_question';
  sessionId: string;
  span: string;
  confidence: number;
  kind: 'partial' | 'final';
}

export interface SuppressedMessage extends ServerMessage {
  type: 'suppressed';
  sessionId: string;
  reason: string;
  span: string;
}

export interface ErrorMessage extends ServerMessage {
  type: 'error';
  message: string;
}

// Orchestrator states
export type OrchestratorState = 'LISTENING' | 'CANDIDATE' | 'STREAMING_T0' | 'REFINE_T1' | 'DONE';

// Session state
export interface SessionStateData {
  sessionId: string;
  userId: string;
  state: OrchestratorState;
  lastQuestionFingerprint: string | null;
  lastQuestionTime: Date | null;
  activeRequestId: string | null;
  recentAssistantOutputs: string[];
  responseStyle: string;
  customStylePrompt: string | null;
  transcriptBuffer: TranscriptEntry[];
  lastPartialText: string;
  lastPartialTime: number;
  stabilityCounter: number;
}

export interface TranscriptEntry {
  text: string;
  source: 'partial' | 'final';
  confidence?: number;
  seq: number;
  timestamp: number;
}

// Question detection result
export interface QuestionDetectionResult {
  isQuestion: boolean;
  confidence: number;
  span: string;
  fingerprint: string;
  kind: 'partial' | 'final';
  suppressReason?: string;
}

// LLM provider types
export type LLMProvider = 'openai' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface LLMStreamChunk {
  text: string;
  done: boolean;
  error?: string;
}

// User authentication
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

// Metrics
export interface MetricData {
  requestId: string;
  sessionId: string;
  provider: string;
  model: string;
  ttftMs: number | null;
  totalMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  suppressReason: string | null;
}

// Response styles
export type ResponseStyle = 'short' | 'star' | 'detailed' | 'technical' | 'custom';

export interface StyleConfig {
  name: string;
  prompt: string;
  maxTokens: number;
}

export const RESPONSE_STYLES: Record<ResponseStyle, StyleConfig> = {
  short: {
    name: 'Short',
    prompt: 'Be concise. Answer in 1-2 sentences maximum.',
    maxTokens: 150
  },
  star: {
    name: 'STAR Method',
    prompt: 'Use the STAR method (Situation, Task, Action, Result) for structured answers.',
    maxTokens: 400
  },
  detailed: {
    name: 'Detailed',
    prompt: 'Provide a comprehensive, well-structured answer with examples.',
    maxTokens: 500
  },
  technical: {
    name: 'Technical',
    prompt: 'Provide a technically accurate answer with code examples if relevant.',
    maxTokens: 500
  },
  custom: {
    name: 'Custom',
    prompt: '',
    maxTokens: 400
  }
};
