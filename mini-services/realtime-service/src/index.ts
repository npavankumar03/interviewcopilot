import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import { getUserFromToken } from './auth.js';
import { 
  processSttPartial, 
  processSttFinal, 
  processManualAnswer, 
  startStreaming, 
  cancelStream 
} from './orchestrator.js';
import { 
  getSessionState, 
  updateSessionState, 
  clearCachedSession 
} from './session-manager.js';
import { setLLMConfig } from './llm.js';
import prisma from './prisma.js';
import type { AuthUser } from './types.js';

const PORT = 3003;

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// User socket map
const userSockets = new Map<string, Set<string>>();

// Load API settings on startup
async function loadApiSettings(): Promise<void> {
  try {
    const settings = await prisma.apiSetting.findMany();
    const config: Record<string, string> = {};
    
    for (const setting of settings) {
      // In production, decrypt here
      config[setting.key] = setting.encryptedValue;
    }
    
    setLLMConfig({
      openaiKey: config.openai_api_key || process.env.OPENAI_API_KEY,
      geminiKey: config.gemini_api_key || process.env.GEMINI_API_KEY,
      openaiModel: config.openai_model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      geminiModel: config.gemini_model || process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    });
    
    console.log('API settings loaded');
  } catch (error) {
    console.error('Failed to load API settings:', error);
  }
}

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const user = await getUserFromToken(token);
    if (!user) {
      return next(new Error('Invalid or expired token'));
    }
    
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Connection handler
io.on('connection', async (socket) => {
  const user = socket.data.user as AuthUser;
  console.log(`User connected: ${user.email} (${socket.id})`);
  
  // Track user sockets
  if (!userSockets.has(user.id)) {
    userSockets.set(user.id, new Set());
  }
  userSockets.get(user.id)!.add(socket.id);
  
  // Send welcome
  socket.emit('message', {
    type: 'connected',
    userId: user.id,
    role: user.role
  });
  
  // Handle messages
  socket.on('message', async (data) => {
    try {
      await handleMessage(socket, user, data);
    } catch (error) {
      console.error('Message handling error:', error);
      socket.emit('message', {
        type: 'error',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${user.email} (${socket.id})`);
    
    const userSocketSet = userSockets.get(user.id);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        userSockets.delete(user.id);
      }
    }
  });
});

async function handleMessage(socket: any, user: AuthUser, data: any): Promise<void> {
  const { type } = data;
  
  switch (type) {
    case 'session_join': {
      const { sessionId } = data;
      
      // Verify user owns the session
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });
      
      if (!session || session.userId !== user.id) {
        socket.emit('message', {
          type: 'error',
          message: 'Session not found or access denied'
        });
        return;
      }
      
      // Join room
      socket.join(`session:${sessionId}`);
      
      // Initialize session state
      const state = await getSessionState(sessionId);
      
      socket.emit('message', {
        type: 'session_joined',
        sessionId,
        state: state?.state || 'LISTENING',
        responseStyle: session.responseStyle
      });
      
      console.log(`User ${user.email} joined session ${sessionId}`);
      break;
    }
    
    case 'stt_partial': {
      const { sessionId, text, sttConfidence, seq } = data;
      
      // Verify session access
      const state = await getSessionState(sessionId);
      if (!state || state.userId !== user.id) {
        return;
      }
      
      const result = await processSttPartial(sessionId, text, sttConfidence, seq, socket);
      
      if (result.action === 'stream' && result.question && result.requestId) {
        await startStreaming(sessionId, result.question, result.requestId, result.confidence || 0, socket);
      }
      break;
    }
    
    case 'stt_final': {
      const { sessionId, text, sttConfidence, seq } = data;
      
      const state = await getSessionState(sessionId);
      if (!state || state.userId !== user.id) {
        return;
      }
      
      const result = await processSttFinal(sessionId, text, sttConfidence, seq, socket);
      
      if (result.action === 'stream' && result.question && result.requestId) {
        await startStreaming(sessionId, result.question, result.requestId, result.confidence || 0, socket);
      }
      break;
    }
    
    case 'manual_answer': {
      const { sessionId, text } = data;
      
      const state = await getSessionState(sessionId);
      if (!state || state.userId !== user.id) {
        return;
      }
      
      const result = await processManualAnswer(sessionId, text, socket);
      
      if (result.action === 'stream' && result.question && result.requestId) {
        await startStreaming(sessionId, result.question, result.requestId, result.confidence || 0, socket);
      }
      break;
    }
    
    case 'answer_cancel': {
      const { sessionId } = data;
      
      await cancelStream(sessionId);
      
      socket.emit('message', {
        type: 'answer_cancelled',
        sessionId
      });
      break;
    }
    
    case 'update_style': {
      const { sessionId, responseStyle, customStylePrompt } = data;
      
      const state = await getSessionState(sessionId);
      if (!state || state.userId !== user.id) {
        return;
      }
      
      await prisma.session.update({
        where: { id: sessionId },
        data: { responseStyle, customStylePrompt }
      });
      
      await updateSessionState(sessionId, {
        responseStyle,
        customStylePrompt: customStylePrompt || null
      });
      
      socket.emit('message', {
        type: 'style_updated',
        sessionId,
        responseStyle
      });
      break;
    }
    
    case 'session_leave': {
      const { sessionId } = data;
      socket.leave(`session:${sessionId}`);
      clearCachedSession(sessionId);
      
      socket.emit('message', {
        type: 'session_left',
        sessionId
      });
      break;
    }
    
    default:
      console.log(`Unknown message type: ${type}`);
  }
}

// Health check endpoint
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'realtime-service' }));
    return;
  }
  
  res.writeHead(404);
  res.end();
});

// Start server
loadApiSettings().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Realtime service listening on port ${PORT}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
