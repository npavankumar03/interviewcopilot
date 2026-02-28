import prisma from './prisma.js';
import type { SessionStateData, OrchestratorState, TranscriptEntry } from './types.js';

// In-memory session state cache for fast access
const sessionStates = new Map<string, SessionStateData>();

export async function getSessionState(sessionId: string): Promise<SessionStateData | null> {
  // Check cache first
  if (sessionStates.has(sessionId)) {
    return sessionStates.get(sessionId)!;
  }
  
  // Load from database
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      transcriptTurns: {
        orderBy: { seq: 'desc' },
        take: 50
      }
    }
  });
  
  if (!session) return null;
  
  // Check for existing session state in DB
  const dbState = await prisma.sessionState.findUnique({
    where: { sessionId }
  });
  
  const transcriptBuffer: TranscriptEntry[] = session.transcriptTurns
    .reverse()
    .map(t => ({
      text: t.text,
      source: t.source as 'partial' | 'final',
      confidence: t.confidence ?? undefined,
      seq: t.seq,
      timestamp: t.createdAt.getTime()
    }));
  
  const state: SessionStateData = {
    sessionId,
    userId: session.userId,
    state: (dbState?.state as OrchestratorState) || 'LISTENING',
    lastQuestionFingerprint: dbState?.lastQuestionFingerprint ?? null,
    lastQuestionTime: dbState?.lastQuestionTime ?? null,
    activeRequestId: dbState?.activeRequestId ?? null,
    recentAssistantOutputs: dbState?.recentAssistantOutputs 
      ? JSON.parse(dbState.recentAssistantOutputs) 
      : [],
    responseStyle: session.responseStyle,
    customStylePrompt: session.customStylePrompt,
    transcriptBuffer,
    lastPartialText: '',
    lastPartialTime: 0,
    stabilityCounter: 0
  };
  
  // Cache it
  sessionStates.set(sessionId, state);
  
  return state;
}

export async function updateSessionState(
  sessionId: string, 
  updates: Partial<SessionStateData>
): Promise<void> {
  const current = sessionStates.get(sessionId);
  if (!current) return;
  
  // Update cache
  const updated = { ...current, ...updates };
  sessionStates.set(sessionId, updated);
  
  // Persist to database
  await prisma.sessionState.upsert({
    where: { sessionId },
    create: {
      sessionId,
      state: updated.state,
      lastQuestionFingerprint: updated.lastQuestionFingerprint,
      lastQuestionTime: updated.lastQuestionTime,
      activeRequestId: updated.activeRequestId,
      recentAssistantOutputs: JSON.stringify(updated.recentAssistantOutputs)
    },
    update: {
      state: updated.state,
      lastQuestionFingerprint: updated.lastQuestionFingerprint,
      lastQuestionTime: updated.lastQuestionTime,
      activeRequestId: updated.activeRequestId,
      recentAssistantOutputs: JSON.stringify(updated.recentAssistantOutputs)
    }
  });
}

export function getCachedSessionState(sessionId: string): SessionStateData | undefined {
  return sessionStates.get(sessionId);
}

export function setCachedSessionState(sessionId: string, state: SessionStateData): void {
  sessionStates.set(sessionId, state);
}

export function clearCachedSession(sessionId: string): void {
  sessionStates.delete(sessionId);
}

export async function addTranscriptEntry(
  sessionId: string,
  text: string,
  source: 'partial' | 'final',
  confidence: number | undefined,
  seq: number
): Promise<void> {
  // Store in database
  await prisma.transcriptTurn.create({
    data: {
      sessionId,
      text,
      source,
      confidence,
      seq
    }
  });
  
  // Update cache
  const state = sessionStates.get(sessionId);
  if (state) {
    state.transcriptBuffer.push({
      text,
      source,
      confidence,
      seq,
      timestamp: Date.now()
    });
    
    // Keep buffer limited
    if (state.transcriptBuffer.length > 200) {
      state.transcriptBuffer = state.transcriptBuffer.slice(-200);
    }
  }
}

export async function addAssistantMessage(
  sessionId: string,
  requestId: string,
  questionText: string,
  answerText: string,
  tier: 't0' | 't1',
  model: string | undefined,
  provider: string | undefined
): Promise<void> {
  await prisma.assistantMessage.create({
    data: {
      sessionId,
      requestId,
      questionText,
      answerText,
      tier,
      model,
      provider
    }
  });
}

export async function recordMetric(
  requestId: string,
  sessionId: string,
  provider: string,
  model: string,
  ttftMs: number | null,
  totalMs: number | null,
  promptTokens: number | null,
  completionTokens: number | null,
  suppressReason: string | null
): Promise<void> {
  await prisma.llmMetric.create({
    data: {
      sessionId,
      requestId,
      provider,
      model,
      ttftMs,
      totalMs,
      promptTokens,
      completionTokens,
      suppressReason
    }
  });
}

export async function getConversationContext(sessionId: string): Promise<string> {
  const turns = await prisma.transcriptTurn.findMany({
    where: { sessionId, source: 'final' },
    orderBy: { seq: 'asc' },
    take: 20
  });
  
  return turns.map(t => t.text).join('\n');
}

export async function updateConversationSummary(sessionId: string, summary: string): Promise<void> {
  await prisma.conversationSummary.upsert({
    where: { sessionId },
    create: { sessionId, summaryText: summary },
    update: { summaryText: summary }
  });
}

export async function getConversationSummary(sessionId: string): Promise<string | null> {
  const summary = await prisma.conversationSummary.findUnique({
    where: { sessionId }
  });
  return summary?.summaryText ?? null;
}

export async function getUserProfile(userId: string): Promise<{
  fullName: string | null;
  headline: string | null;
  roleTitles: string[];
  techStack: string[];
  achievements: string[];
  projects: string[];
  resumeText: string | null;
} | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId }
  });
  
  if (!profile) return null;
  
  return {
    fullName: profile.fullName,
    headline: profile.headline,
    roleTitles: profile.roleTitles ? JSON.parse(profile.roleTitles) : [],
    techStack: profile.techStack ? JSON.parse(profile.techStack) : [],
    achievements: profile.achievements ? JSON.parse(profile.achievements) : [],
    projects: profile.projects ? JSON.parse(profile.projects) : [],
    resumeText: profile.resumeText
  };
}

export function buildMemoryContext(profile: {
  fullName: string | null;
  headline: string | null;
  roleTitles: string[];
  techStack: string[];
  achievements: string[];
  projects: string[];
  resumeText: string | null;
} | null): string {
  if (!profile) return '';
  
  const parts: string[] = [];
  
  if (profile.fullName) parts.push(`Name: ${profile.fullName}`);
  if (profile.headline) parts.push(`Headline: ${profile.headline}`);
  if (profile.roleTitles.length > 0) parts.push(`Roles: ${profile.roleTitles.join(', ')}`);
  if (profile.techStack.length > 0) parts.push(`Tech Stack: ${profile.techStack.join(', ')}`);
  if (profile.achievements.length > 0) parts.push(`Key Achievements: ${profile.achievements.slice(0, 3).join('; ')}`);
  if (profile.projects.length > 0) parts.push(`Projects: ${profile.projects.slice(0, 3).join('; ')}`);
  
  return parts.join('\n');
}

export async function deductCredits(userId: string, amount: number, reason: string, meta?: Record<string, unknown>): Promise<boolean> {
  // Check current balance
  const ledger = await prisma.creditsLedger.findMany({
    where: { userId }
  });
  
  const balance = ledger.reduce((sum, entry) => sum + entry.delta, 0);
  
  if (balance < amount) {
    return false; // Insufficient credits
  }
  
  await prisma.creditsLedger.create({
    data: {
      userId,
      delta: -amount,
      reason,
      meta: meta ? JSON.stringify(meta) : null
    }
  });
  
  return true;
}

export async function getSessionUploads(sessionId: string): Promise<Array<{ extractedText: string | null }>> {
  return prisma.upload.findMany({
    where: { sessionId },
    select: { extractedText: true }
  });
}

export function buildDocContext(uploads: Array<{ extractedText: string | null }>): string {
  const texts = uploads
    .map(u => u.extractedText)
    .filter((t): t is string => t !== null);
  
  if (texts.length === 0) return '';
  
  return texts.join('\n\n---\n\n').slice(0, 4000);
}
