import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFoundError } from '@/lib/api-utils';
import ZAI from 'z-ai-web-dev-sdk';

// GET: SSE stream for answers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: sessionId } = await params;

  // Verify session belongs to user
  const session = await db.session.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    include: {
      profile: {
        include: {
          user: {
            select: {
              profile: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    return notFoundError('Session');
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const sendMessage = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream might be closed
        }
      };

      sendMessage('connected', { sessionId, status: 'connected' });

      // Poll for new transcript turns and generate answers
      let lastSeq = 0;
      let lastQuestionText = '';
      
      // Get initial state
      const sessionState = await db.sessionState.findUnique({
        where: { sessionId },
      });

      if (sessionState) {
        lastSeq = await db.transcriptTurn.count({
          where: { sessionId },
        });
      }

      // Keep connection alive and process questions
      const interval = setInterval(async () => {
        try {
          // Check if session is still active
          const currentSession = await db.session.findUnique({
            where: { id: sessionId },
            select: { status: true },
          });

          if (!currentSession || currentSession.status === 'ended') {
            sendMessage('session_ended', { sessionId });
            clearInterval(interval);
            closed = true;
            controller.close();
            return;
          }

          // Check for new transcript turns
          const newTurns = await db.transcriptTurn.findMany({
            where: {
              sessionId,
              seq: { gt: lastSeq },
              source: 'final',
            },
            orderBy: { seq: 'asc' },
          });

          if (newTurns.length > 0) {
            lastSeq = newTurns[newTurns.length - 1].seq;
            
            // Combine turns to detect questions
            const recentText = newTurns.map(t => t.text).join(' ');
            
            // Simple question detection
            if (recentText.includes('?') || 
                recentText.toLowerCase().match(/^(what|how|why|when|where|who|can you|could you|tell me|explain)/i)) {
              
              // Avoid processing the same question twice
              const questionFingerprint = recentText.slice(0, 100);
              
              if (questionFingerprint !== lastQuestionText.slice(0, 100)) {
                lastQuestionText = recentText;
                
                // Generate answer using LLM
                sendMessage('question_detected', { text: recentText.slice(0, 200) });
                
                try {
                  const zai = await ZAI.create();
                  
                  // Build context from session
                  const context: string[] = [];
                  
                  if (session.type) {
                    context.push(`Session type: ${session.type}`);
                  }
                  
                  if (session.responseStyle) {
                    context.push(`Response style: ${session.responseStyle}`);
                  }
                  
                  // Get user profile context
                  const userProfile = await db.userProfile.findUnique({
                    where: { userId: user.id },
                  });
                  
                  if (userProfile) {
                    if (userProfile.fullName) {
                      context.push(`User name: ${userProfile.fullName}`);
                    }
                    if (userProfile.headline) {
                      context.push(`User headline: ${userProfile.headline}`);
                    }
                    if (userProfile.roleTitles) {
                      context.push(`User roles: ${userProfile.roleTitles}`);
                    }
                    if (userProfile.techStack) {
                      context.push(`User tech stack: ${userProfile.techStack}`);
                    }
                  }

                  const systemPrompt = `You are an AI assistant helping during a ${session.type || 'meeting'} session.
${context.length > 0 ? 'Context:\n' + context.join('\n') : ''}

Provide helpful, concise answers to questions. The response style should be: ${session.responseStyle || 'short'}.
${session.responseStyle === 'star' ? 'Use the STAR method (Situation, Task, Action, Result) for behavioral questions.' : ''}
${session.responseStyle === 'technical' ? 'Provide technical details and code examples when relevant.' : ''}
${session.customStylePrompt ? 'Custom instructions: ' + session.customStylePrompt : ''}`;

                  const completion = await zai.chat.completions.create({
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: recentText },
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                  });

                  const answer = completion.choices[0]?.message?.content || '';
                  
                  // Save assistant message
                  const requestId = `${sessionId}-${Date.now()}`;
                  await db.assistantMessage.create({
                    data: {
                      sessionId,
                      requestId,
                      questionText: recentText.slice(0, 500),
                      tier: 't0',
                      answerText: answer,
                      model: completion.model,
                      provider: 'z-ai',
                    },
                  });

                  // Update session state
                  await db.sessionState.updateMany({
                    where: { sessionId },
                    data: {
                      lastQuestionFingerprint: questionFingerprint,
                      lastQuestionTime: new Date(),
                    },
                  });

                  sendMessage('answer', {
                    requestId,
                    question: recentText.slice(0, 200),
                    answer,
                    tier: 't0',
                  });
                  
                } catch (llmError) {
                  console.error('LLM error:', llmError);
                  sendMessage('error', { 
                    message: 'Failed to generate answer',
                    details: llmError instanceof Error ? llmError.message : 'Unknown error'
                  });
                }
              }
            }
          }

          // Send heartbeat
          sendMessage('heartbeat', { timestamp: Date.now() });
          
        } catch (error) {
          console.error('Stream error:', error);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup on close
      setTimeout(() => {
        clearInterval(interval);
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }, 30 * 60 * 1000); // Close after 30 minutes
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
