import type { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { SessionStateData, ResponseStyle } from './types.js';
import { detectQuestion, updateRecentOutputs } from './question-detector.js';
import { 
  getSessionState, 
  updateSessionState, 
  addTranscriptEntry,
  addAssistantMessage,
  recordMetric,
  getConversationContext,
  getUserProfile,
  buildMemoryContext,
  deductCredits,
  getSessionUploads,
  buildDocContext
} from './session-manager.js';
import { streamLLM, generateLLM, resolveProvider } from './llm.js';

// Active stream controllers for cancellation
const activeStreams = new Map<string, {
  abortController: AbortController;
  requestId: string;
}>();

export interface OrchestratorResult {
  action: 'none' | 'stream' | 'suppress';
  question?: string;
  confidence?: number;
  requestId?: string;
  suppressReason?: string;
}

export async function processSttPartial(
  sessionId: string,
  text: string,
  confidence: number | undefined,
  seq: number,
  socket: Socket
): Promise<OrchestratorResult> {
  const state = await getSessionState(sessionId);
  if (!state) {
    return { action: 'none' };
  }
  
  const now = Date.now();
  
  // Update stability tracking
  const textChanged = text !== state.lastPartialText;
  const stabilityCounter = textChanged ? 0 : state.stabilityCounter + 1;
  
  // Update session state
  const updates: Partial<SessionStateData> = {
    lastPartialText: text,
    lastPartialTime: now,
    stabilityCounter
  };
  
  // Add to transcript buffer (partial)
  await addTranscriptEntry(sessionId, text, 'partial', confidence, seq);
  
  // Check if we're already streaming - if so, check for barge-in
  if (state.state === 'STREAMING_T0' || state.state === 'REFINE_T1') {
    // Check for barge-in with high confidence new question
    const detectionContext = {
      lastFingerprint: state.lastQuestionFingerprint,
      lastQuestionTime: state.lastQuestionTime ? state.lastQuestionTime.getTime() : null,
      recentAssistantOutputs: state.recentAssistantOutputs,
      lastPartialText: state.lastPartialText,
      lastPartialTime: state.lastPartialTime,
      stabilityCounter: state.stabilityCounter
    };
    
    const detection = detectQuestion(
      text,
      confidence,
      true, // isPartial
      state.transcriptBuffer,
      detectionContext,
      now
    );
    
    // High confidence barge-in
    if (detection.isQuestion && detection.confidence > 0.85) {
      await cancelStream(sessionId);
      socket.emit('message', {
        type: 'suppressed',
        sessionId,
        reason: 'barge_in',
        span: detection.span
      });
    }
  }
  
  // Only process if in LISTENING or CANDIDATE state
  if (state.state !== 'LISTENING' && state.state !== 'CANDIDATE') {
    await updateSessionState(sessionId, updates);
    return { action: 'none' };
  }
  
  // Question detection
  const detectionContext = {
    lastFingerprint: state.lastQuestionFingerprint,
    lastQuestionTime: state.lastQuestionTime ? state.lastQuestionTime.getTime() : null,
    recentAssistantOutputs: state.recentAssistantOutputs,
    lastPartialText: state.lastPartialText,
    lastPartialTime: state.lastPartialTime,
    stabilityCounter: state.stabilityCounter
  };
  
  const detection = detectQuestion(
    text,
    confidence,
    true, // isPartial
    state.transcriptBuffer,
    detectionContext,
    now
  );
  
  await updateSessionState(sessionId, updates);
  
  if (detection.isQuestion) {
    // Emit detected question event
    socket.emit('message', {
      type: 'detected_question',
      sessionId,
      span: detection.span,
      confidence: detection.confidence,
      kind: 'partial'
    });
    
    return {
      action: 'stream',
      question: detection.span,
      confidence: detection.confidence,
      requestId: uuidv4()
    };
  } else if (detection.suppressReason && detection.confidence > 0.5) {
    // Only emit suppression for high-confidence detections that were suppressed
    socket.emit('message', {
      type: 'suppressed',
      sessionId,
      reason: detection.suppressReason,
      span: detection.span
    });
    return {
      action: 'suppress',
      suppressReason: detection.suppressReason
    };
  }
  
  return { action: 'none' };
}

export async function processSttFinal(
  sessionId: string,
  text: string,
  confidence: number | undefined,
  seq: number,
  socket: Socket
): Promise<OrchestratorResult> {
  const state = await getSessionState(sessionId);
  if (!state) {
    return { action: 'none' };
  }
  
  const now = Date.now();
  
  // Add to transcript
  await addTranscriptEntry(sessionId, text, 'final', confidence, seq);
  
  // Only process if in LISTENING or CANDIDATE state
  if (state.state !== 'LISTENING' && state.state !== 'CANDIDATE') {
    return { action: 'none' };
  }
  
  // Question detection for final transcript
  const detectionContext = {
    lastFingerprint: state.lastQuestionFingerprint,
    lastQuestionTime: state.lastQuestionTime ? state.lastQuestionTime.getTime() : null,
    recentAssistantOutputs: state.recentAssistantOutputs,
    lastPartialText: '',
    lastPartialTime: 0,
    stabilityCounter: 0
  };
  
  const detection = detectQuestion(
    text,
    confidence,
    false, // isPartial = false
    state.transcriptBuffer,
    detectionContext,
    now
  );
  
  if (detection.isQuestion) {
    socket.emit('message', {
      type: 'detected_question',
      sessionId,
      span: detection.span,
      confidence: detection.confidence,
      kind: 'final'
    });
    
    return {
      action: 'stream',
      question: detection.span,
      confidence: detection.confidence,
      requestId: uuidv4()
    };
  } else if (detection.suppressReason) {
    socket.emit('message', {
      type: 'suppressed',
      sessionId,
      reason: detection.suppressReason,
      span: detection.span
    });
    return {
      action: 'suppress',
      suppressReason: detection.suppressReason
    };
  }
  
  return { action: 'none' };
}

export async function processManualAnswer(
  sessionId: string,
  text: string,
  socket: Socket
): Promise<OrchestratorResult> {
  const state = await getSessionState(sessionId);
  if (!state) {
    return { action: 'none' };
  }
  
  // Cancel any active stream
  await cancelStream(sessionId);
  
  // Create fingerprint for dedupe check
  const fingerprint = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  // Check for recent duplicate (hard dedupe even for manual)
  if (state.lastQuestionFingerprint && state.lastQuestionTime) {
    const timeSince = Date.now() - state.lastQuestionTime.getTime();
    const similarity = fingerprint.split(' ').filter(w => 
      state.lastQuestionFingerprint?.includes(w)
    ).length / fingerprint.split(' ').length;
    
    if (similarity > 0.9 && timeSince < 5000) {
      socket.emit('message', {
        type: 'suppressed',
        sessionId,
        reason: 'dedupe',
        span: text
      });
      return { action: 'suppress', suppressReason: 'dedupe' };
    }
  }
  
  return {
    action: 'stream',
    question: text,
    confidence: 1.0, // Manual answers have full confidence
    requestId: uuidv4()
  };
}

export async function startStreaming(
  sessionId: string,
  question: string,
  requestId: string,
  confidence: number,
  socket: Socket
): Promise<void> {
  const state = await getSessionState(sessionId);
  if (!state) return;
  
  // Create abort controller for this stream
  const abortController = new AbortController();
  activeStreams.set(sessionId, { abortController, requestId });
  
  // Update state
  await updateSessionState(sessionId, {
    state: 'STREAMING_T0',
    activeRequestId: requestId,
    lastQuestionFingerprint: question.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
    lastQuestionTime: new Date()
  });
  
  // Emit start event immediately
  socket.emit('message', {
    type: 'assistant_start',
    sessionId,
    requestId,
    question
  });
  
  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let fullAnswer = '';
  
  try {
    // Get minimal context for Tier 0
    const conversationContext = await getConversationContext(sessionId);
    
    // Start streaming Tier 0
    const stream = streamLLM({
      question,
      style: state.responseStyle as ResponseStyle,
      customStylePrompt: state.customStylePrompt ?? undefined,
      conversationContext,
      tier: 't0'
    });
    
    let provider: string = 'unknown';
    let model: string = 'unknown';
    
    try {
      const resolved = resolveProvider();
      provider = resolved.provider;
      model = resolved.model;
    } catch {
      // Use defaults
    }
    
    for await (const chunk of stream) {
      // Check for abort
      if (abortController.signal.aborted) {
        break;
      }
      
      if (chunk.error) {
        socket.emit('message', {
          type: 'error',
          message: chunk.error
        });
        break;
      }
      
      if (chunk.text) {
        if (firstTokenTime === null) {
          firstTokenTime = Date.now();
        }
        fullAnswer += chunk.text;
        
        // Emit chunk
        socket.emit('message', {
          type: 'assistant_chunk',
          sessionId,
          requestId,
          text: chunk.text
        });
      }
      
      if (chunk.done) {
        break;
      }
    }
    
    const endTime = Date.now();
    const ttftMs = firstTokenTime ? firstTokenTime - startTime : null;
    const totalMs = endTime - startTime;
    
    // Record metric
    let providerForMetric: string = 'unknown';
    let modelForMetric: string = 'unknown';
    try {
      const resolved = resolveProvider();
      providerForMetric = resolved.provider;
      modelForMetric = resolved.model;
    } catch {
      // Use defaults
    }
    
    await recordMetric(
      requestId,
      sessionId,
      providerForMetric,
      modelForMetric,
      ttftMs,
      totalMs,
      null,
      null,
      null
    );
    
    // Store assistant message
    await addAssistantMessage(
      sessionId,
      requestId,
      question,
      fullAnswer,
      't0',
      modelForMetric,
      providerForMetric
    );
    
    // Deduct credits (1 credit per answer)
    await deductCredits(state.userId, 1, 'usage', { requestId, sessionId });
    
    // Update recent outputs for feedback loop detection
    const updatedOutputs = updateRecentOutputs(state.recentAssistantOutputs, fullAnswer);
    await updateSessionState(sessionId, {
      recentAssistantOutputs: updatedOutputs,
      state: 'DONE'
    });
    
    // Emit end event
    socket.emit('message', {
      type: 'assistant_end',
      sessionId,
      requestId
    });
    
    // Start Tier 1 refinement in background (optional)
    startTier1Refinement(sessionId, question, fullAnswer, state, socket).catch(() => {
      // Silently fail Tier 1
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    socket.emit('message', {
      type: 'error',
      message: `Streaming error: ${errorMessage}`
    });
    
    // Record error metric
    await recordMetric(
      requestId,
      sessionId,
      'unknown',
      'unknown',
      null,
      Date.now() - startTime,
      null,
      null,
      'stream_error'
    );
    
    await updateSessionState(sessionId, { state: 'LISTENING' });
  } finally {
    activeStreams.delete(sessionId);
  }
}

async function startTier1Refinement(
  sessionId: string,
  question: string,
  t0Answer: string,
  state: SessionStateData,
  socket: Socket
): Promise<void> {
  try {
    // Get additional context for Tier 1
    const [profile, uploads, conversationContext] = await Promise.all([
      getUserProfile(state.userId),
      getSessionUploads(sessionId),
      getConversationContext(sessionId)
    ]);
    
    const memoryContext = buildMemoryContext(profile);
    const docContext = buildDocContext(uploads);
    
    // Only refine if we have additional context
    if (!memoryContext && !docContext) {
      return;
    }
    
    // Generate refined answer
    const refinedAnswer = await generateLLM({
      question,
      style: state.responseStyle as ResponseStyle,
      customStylePrompt: state.customStylePrompt ?? undefined,
      conversationContext,
      docContext,
      memoryContext,
      tier: 't1'
    });
    
    // Store refined answer
    const refinedRequestId = `${state.activeRequestId}_t1`;
    await addAssistantMessage(
      sessionId,
      refinedRequestId,
      question,
      refinedAnswer,
      't1',
      resolveProvider().model,
      resolveProvider().provider
    );
    
    // Optionally emit refined answer (could be a separate event)
    socket.emit('message', {
      type: 'assistant_refined',
      sessionId,
      requestId: refinedRequestId,
      text: refinedAnswer
    });
    
  } catch (error) {
    // Tier 1 failures are silent
    console.error('Tier 1 refinement error:', error);
  }
}

export async function cancelStream(sessionId: string): Promise<void> {
  const active = activeStreams.get(sessionId);
  if (active) {
    active.abortController.abort();
    activeStreams.delete(sessionId);
    
    // Reset state to listening
    await updateSessionState(sessionId, { state: 'LISTENING' });
  }
}

export function isStreamActive(sessionId: string): boolean {
  return activeStreams.has(sessionId);
}

export function getActiveRequestId(sessionId: string): string | null {
  return activeStreams.get(sessionId)?.requestId ?? null;
}
