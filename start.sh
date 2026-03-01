#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Start Script
# ============================================

cd "$(dirname "$0")"

# Ensure bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

echo ""
echo "🚀 Starting Meeting Copilot..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo "DATABASE_URL=\"file:./db/meeting-copilot.db\"" > .env
    fi
    echo "📝 Please edit .env and add your API keys, then run ./start.sh again"
    echo ""
    exit 1
fi

# Create db directory if not exists
mkdir -p db

# Get absolute path to database
DB_PATH="$(pwd)/db/meeting-copilot.db"
export DATABASE_URL="file:$DB_PATH"

echo "📁 Database: $DB_PATH"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $(jobs -p) 2>/dev/null || true
    echo "✓ All services stopped"
}

trap cleanup EXIT

# Start realtime service in background
echo "📡 Starting realtime service on port 3003..."
cd mini-services/realtime-service
bun --hot src/index.ts &
REALTIME_PID=$!
cd ../..

# Wait for realtime service to start
sleep 3

# Check if realtime service started
if ! curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo "⚠️  Realtime service may not have started correctly"
    echo "   PID: $REALTIME_PID"
fi

# Start main application
echo "🌐 Starting Next.js application on port 3000..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🎉 Meeting Copilot is running!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  📱 App:        http://localhost:3000"
echo "  🔌 WebSocket:  ws://localhost:3003"
echo "  📊 Health:     http://localhost:3000/api/health"
echo ""
echo "  Test Accounts:"
echo "    Admin: admin@meetingcopilot.com / admin123"
echo "    Demo:  demo@meetingcopilot.com / demo123"
echo ""
echo "  Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════════════"
echo ""

bunx next dev -p 3000
