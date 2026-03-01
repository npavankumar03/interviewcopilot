import type { QuestionDetectionResult, TranscriptEntry } from './types.js';

// Question detection thresholds
const PARTIAL_TRIGGER_THRESHOLD = 0.88;
const FINAL_TRIGGER_THRESHOLD = 0.65;
const STABILITY_WINDOW_MS = 350;
const DEDEPE_SIMILARITY_THRESHOLD = 0.85;
const DEDEPE_WINDOW_MS = 12000;
const FEEDBACK_OVERLAP_THRESHOLD = 0.60;
const MAX_RECENT_OUTPUTS = 5;
const OUTPUT_COMPARE_LENGTH = 400;

// Question patterns
const QUESTION_PATTERNS = [
  /\?$/,
  /^(what|who|when|where|why|how|which|whose|whom)/i,
  /^(can you|could you|would you|will you|do you|did you|are you|is there|are there|have you|has it)/i,
  /^(tell me|explain|describe|list|name|give me|show me)/i,
  /^(help me|assist me|i need|i want)/i,
  /\b(right\?|correct\?|okay\?|ok\?|yeah\?)$/i
];

// Stop words for fingerprint normalization
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
  'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
  'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'been'
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createFingerprint(text: string): string {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => !STOP_WORDS.has(w));
  return words.sort().join(' ');
}

export function calculateSimilarity(fp1: string, fp2: string): number {
  if (!fp1 || !fp2) return 0;
  
  const words1 = new Set(fp1.split(' '));
  const words2 = new Set(fp2.split(' '));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

export function calculateQuestionConfidence(text: string, isPartial: boolean): number {
  let confidence = 0.3; // Base confidence
  
  // Check for question patterns
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(text)) {
      confidence += 0.2;
      break;
    }
  }
  
  // Length bonus (longer questions more likely real)
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 3 && wordCount <= 20) {
    confidence += 0.15;
  } else if (wordCount > 20) {
    confidence += 0.1;
  }
  
  // Question mark bonus
  if (text.includes('?')) {
    confidence += 0.15;
  }
  
  // Starts with question word
  if (/^(what|who|when|where|why|how|which)/i.test(text.trim())) {
    confidence += 0.1;
  }
  
  // Partial penalty (more uncertainty)
  if (isPartial) {
    confidence *= 0.95;
  }
  
  return Math.min(confidence, 1.0);
}

export function extractQuestionSpan(transcript: TranscriptEntry[]): string {
  // Get recent text from transcript
  const recentEntries = transcript.slice(-10);
  const text = recentEntries
    .map(e => e.text)
    .join(' ')
    .trim();
  
  // Try to find the question part
  // Look for the last sentence that looks like a question
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  if (sentences.length === 0) {
    return text;
  }
  
  // Return last sentence if it looks like a question
  const lastSentence = sentences[sentences.length - 1].trim();
  if (QUESTION_PATTERNS.some(p => p.test(lastSentence))) {
    return lastSentence;
  }
  
  // Otherwise return last couple of sentences
  return sentences.slice(-2).join('. ').trim();
}

export interface DetectionContext {
  lastFingerprint: string | null;
  lastQuestionTime: number | null;
  recentAssistantOutputs: string[];
  lastPartialText: string;
  lastPartialTime: number;
  stabilityCounter: number;
}

export function detectQuestion(
  text: string,
  confidence: number | undefined,
  isPartial: boolean,
  transcript: TranscriptEntry[],
  context: DetectionContext,
  now: number = Date.now()
): QuestionDetectionResult {
  const sttConfidence = confidence ?? 0.8;
  const questionSpan = extractQuestionSpan(transcript);
  const questionConfidence = calculateQuestionConfidence(questionSpan, isPartial);
  const fingerprint = createFingerprint(questionSpan);
  
  // Combined confidence (STT + question detection)
  const combinedConfidence = sttConfidence * 0.4 + questionConfidence * 0.6;
  
  // Determine threshold based on partial vs final
  const threshold = isPartial ? PARTIAL_TRIGGER_THRESHOLD : FINAL_TRIGGER_THRESHOLD;
  
  // Check if confidence meets threshold
  if (combinedConfidence < threshold) {
    return {
      isQuestion: false,
      confidence: combinedConfidence,
      span: questionSpan,
      fingerprint,
      kind: isPartial ? 'partial' : 'final',
      suppressReason: 'low_confidence'
    };
  }
  
  // Stability gating for partial results
  if (isPartial) {
    const timeSinceLastPartial = now - context.lastPartialTime;
    const textChanged = text !== context.lastPartialText;
    
    if (textChanged) {
      // Text is still changing, reset stability
      return {
        isQuestion: false,
        confidence: combinedConfidence,
        span: questionSpan,
        fingerprint,
        kind: 'partial',
        suppressReason: 'unstable_partial'
      };
    }
    
    // Check stability - need at least STABILITY_WINDOW_MS of unchanged text
    // Or seen twice with same fingerprint
    if (timeSinceLastPartial < STABILITY_WINDOW_MS && context.stabilityCounter < 1) {
      return {
        isQuestion: false,
        confidence: combinedConfidence,
        span: questionSpan,
        fingerprint,
        kind: 'partial',
        suppressReason: 'unstable_partial'
      };
    }
  }
  
  // Dedupe check
  if (context.lastFingerprint && context.lastQuestionTime) {
    const timeSinceLast = now - context.lastQuestionTime;
    const similarity = calculateSimilarity(fingerprint, context.lastFingerprint);
    
    if (similarity >= DEDEPE_SIMILARITY_THRESHOLD && timeSinceLast < DEDEPE_WINDOW_MS) {
      return {
        isQuestion: false,
        confidence: combinedConfidence,
        span: questionSpan,
        fingerprint,
        kind: isPartial ? 'partial' : 'final',
        suppressReason: 'dedupe'
      };
    }
  }
  
  // Feedback loop detection
  const suppressReason = checkFeedbackLoop(questionSpan, context.recentAssistantOutputs);
  if (suppressReason) {
    return {
      isQuestion: false,
      confidence: combinedConfidence,
      span: questionSpan,
      fingerprint,
      kind: isPartial ? 'partial' : 'final',
      suppressReason
    };
  }
  
  return {
    isQuestion: true,
    confidence: combinedConfidence,
    span: questionSpan,
    fingerprint,
    kind: isPartial ? 'partial' : 'final'
  };
}

function checkFeedbackLoop(text: string, recentOutputs: string[]): string | null {
  if (recentOutputs.length === 0) return null;
  
  const normalizedText = normalizeText(text);
  const textWords = new Set(normalizedText.split(' '));
  
  for (const output of recentOutputs) {
    const outputStart = output.slice(0, OUTPUT_COMPARE_LENGTH).toLowerCase();
    const outputWords = new Set(normalizeText(outputStart).split(' '));
    
    // Calculate word overlap
    const intersection = new Set([...textWords].filter(w => outputWords.has(w)));
    const smallerSize = Math.min(textWords.size, outputWords.size);
    
    if (smallerSize > 0 && intersection.size / smallerSize > FEEDBACK_OVERLAP_THRESHOLD) {
      return 'feedback_loop';
    }
  }
  
  return null;
}

export function updateRecentOutputs(outputs: string[], newOutput: string): string[] {
  const updated = [...outputs, newOutput];
  if (updated.length > MAX_RECENT_OUTPUTS) {
    return updated.slice(-MAX_RECENT_OUTPUTS);
  }
  return updated;
}
