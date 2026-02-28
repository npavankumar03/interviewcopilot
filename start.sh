#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Start Script
# ============================================

cd "$(dirname "$0")"

echo ""
echo "🚀 Starting Meeting Copilot..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env and add your API keys, then run ./start.sh again"
    echo ""
    exit 1
fi

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
bun run dev &
cd ../..

# Wait for realtime service to start
sleep 2

# Check if realtime service started
if ! curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo "⚠️  Realtime service may not have started correctly"
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

bun run dev
