# Meeting Copilot SaaS

A production-grade real-time meeting copilot application that streams live transcription, detects questions mid-sentence with high precision, and streams structured answers instantly.

## 🚀 Features

### Core Functionality
- **Live Transcription**: Real-time speech-to-text using Azure STT or Web Speech API fallback
- **Question Detection**: Mid-sentence trigger on partial transcripts with confidence scoring
- **Instant Answer Streaming**: TTFT optimized (< 900ms) with multi-tier responses
- **Feedback Loop Suppression**: Prevents answering the assistant's own audio
- **Barge-in Support**: Cancel current answer when a new question is detected

### Response Styles
- **Short**: Concise 1-2 sentence answers
- **STAR Method**: Structured Situation-Task-Action-Result format
- **Detailed**: Comprehensive answers with examples
- **Technical**: Technical answers with code examples
- **Custom**: User-defined response format

### User Features
- **Dashboard**: Session management and quick stats
- **Live Session UI**: Real-time transcript and answer panels
- **Stealth Mode**: Compact overlay with blur toggle
- **Profile Management**: Memory slots for personalized responses
- **History**: Searchable session archive

### Admin Features
- **User Management**: List, disable, modify users
- **Plans & Billing**: Subscription management
- **API Settings**: Encrypted key storage
- **Metrics Dashboard**: TTFT, latency, usage analytics
- **Audit Logs**: Complete action history

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 16)                    │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  Live Session  │  Profile  │  Admin Panel     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   API Routes (REST)                          │
├─────────────────────────────────────────────────────────────┤
│  /api/auth  │  /api/sessions  │  /api/admin  │  /api/...    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Realtime Service (WebSocket - Port 3003)        │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator  │  Question Detector  │  LLM Streaming       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Database (SQLite/PostgreSQL)              │
├─────────────────────────────────────────────────────────────┤
│  Users  │  Sessions  │  Transcripts  │  Metrics  │  ...     │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- Node.js 20+ or Bun
- SQLite (default) or PostgreSQL
- OpenAI API key or Google Gemini API key
- Azure Speech Services key (optional, for production STT)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository>
cd meeting-copilot-saas
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
DATABASE_URL="file:./db/custom.db"
JWT_SECRET="your-secure-random-string"
OPENAI_API_KEY="sk-your-openai-key"
GEMINI_API_KEY="your-gemini-key"
AZURE_SPEECH_KEY="your-azure-key"
AZURE_REGION="eastus"
```

### 3. Initialize Database

```bash
bun run db:push
bun run db:seed
```

### 4. Start Services

```bash
# Start Next.js app (port 3000)
bun run dev

# Start realtime service (port 3003)
cd mini-services/realtime-service && bun run dev
```

## 🧪 Test Accounts

After seeding, you can use these accounts:

| Role   | Email                        | Password  |
|--------|------------------------------|-----------|
| Admin  | admin@meetingcopilot.com     | admin123  |
| Demo   | demo@meetingcopilot.com      | demo123   |

## 📁 Project Structure

```
meeting-copilot-saas/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # REST API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── sessions/      # Session management
│   │   │   ├── admin/         # Admin endpoints
│   │   │   └── ...
│   │   ├── login/             # Login page
│   │   ├── signup/            # Signup page
│   │   ├── session/[id]/      # Live session page
│   │   ├── profile/           # User profile
│   │   ├── settings/          # User settings
│   │   ├── history/           # Session history
│   │   └── admin/             # Admin panel
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── session/           # Session components
│   ├── hooks/                 # Custom React hooks
│   ├── stores/                # Zustand stores
│   └── lib/                   # Utilities
├── mini-services/
│   └── realtime-service/      # WebSocket service (port 3003)
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed script
├── docker-compose.yml         # Docker configuration
├── Dockerfile                 # Production build
└── .env.example               # Environment template
```

## 🔌 API Endpoints

### Authentication
| Method | Endpoint            | Description          |
|--------|---------------------|----------------------|
| POST   | /api/auth/signup    | Create account       |
| POST   | /api/auth/login     | Authenticate         |
| POST   | /api/auth/logout    | End session          |
| GET    | /api/auth/me        | Current user         |

### Sessions
| Method | Endpoint                    | Description          |
|--------|-----------------------------|----------------------|
| GET    | /api/sessions               | List sessions        |
| POST   | /api/sessions               | Create session       |
| GET    | /api/sessions/:id           | Get session          |
| DELETE | /api/sessions/:id           | Delete session       |
| POST   | /api/sessions/:id/end       | End session          |
| GET    | /api/sessions/:id/answer-stream | SSE stream      |

### Admin
| Method | Endpoint               | Description          |
|--------|------------------------|----------------------|
| GET    | /api/admin/users       | List users           |
| PUT    | /api/admin/users/:id   | Update user          |
| GET    | /api/admin/settings    | Get settings         |
| PUT    | /api/admin/settings    | Update settings      |
| GET    | /api/admin/metrics     | Get metrics          |
| GET    | /api/admin/audit-logs  | List audit logs      |

## 🔌 WebSocket Events

### Client → Server
```typescript
{ type: "hello", token: string }
{ type: "session_join", sessionId: string }
{ type: "stt_partial", sessionId: string, text: string, confidence?: number, seq: number }
{ type: "stt_final", sessionId: string, text: string, confidence?: number, seq: number }
{ type: "answer_cancel", sessionId: string }
{ type: "manual_answer", sessionId: string, text: string }
```

### Server → Client
```typescript
{ type: "assistant_start", sessionId: string, requestId: string, question: string }
{ type: "assistant_chunk", sessionId: string, requestId: string, text: string }
{ type: "assistant_end", sessionId: string, requestId: string }
{ type: "detected_question", sessionId: string, span: string, confidence: number, kind: "partial" | "final" }
{ type: "suppressed", sessionId: string, reason: string, span: string }
{ type: "error", message: string }
```

## ⌨️ Keyboard Shortcuts

| Shortcut       | Action                    |
|----------------|---------------------------|
| Space          | Pause/Resume listening    |
| Escape         | Cancel current answer     |
| Ctrl+Enter     | Force answer now          |
| Ctrl+S         | Toggle style menu         |
| Ctrl+Shift+O   | Toggle stealth mode       |

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t meeting-copilot .
docker run -p 3000:3000 -p 3003:3003 meeting-copilot
```

## 📊 Performance Targets

| Metric          | Target      |
|-----------------|-------------|
| TTFT (p50)      | < 900ms     |
| TTFT (p90)      | < 1500ms    |
| Question Detection | < 100ms  |
| Memory Usage    | < 512MB     |

## 🔒 Security Features

- Password hashing with bcrypt
- JWT authentication with configurable expiration
- HTTP-only cookies for sessions
- Encrypted API key storage
- CSRF protection
- Rate limiting on auth endpoints
- No secrets in logs

## 📝 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📧 Support

For issues and feature requests, please use the GitHub issue tracker.
