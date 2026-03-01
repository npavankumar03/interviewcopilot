#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Start Script
# ============================================

cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"

echo ""
echo "🚀 Starting Meeting Copilot..."
echo ""

# Check .env
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    exit 1
fi

# Create db directory
mkdir -p db

# Set absolute database path
DB_PATH="$(pwd)/db/meeting-copilot.db"
export DATABASE_URL="file:$DB_PATH"

echo "📁 Database: $DB_PATH"

# Check if database exists, if not create it
if [ ! -f "$DB_PATH" ]; then
    echo "📊 Database not found. Creating..."
    bun run db:push
    bun run db:seed
    echo "✓ Database created"
fi

# Regenerate Prisma client to ensure it's up to date
echo "🔧 Regenerating Prisma client..."
bun run db:generate 2>/dev/null || true

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    pkill -f "bun --hot" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    echo "✓ All services stopped"
}
trap cleanup EXIT

# Kill any existing processes on our ports
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
sleep 1

# Start realtime service
echo "📡 Starting realtime service on port 3003..."
cd mini-services/realtime-service
DATABASE_URL="file:$DB_PATH" bun --hot src/index.ts &
cd ../..
sleep 3

# Check realtime service
if curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo "✓ Realtime service started"
else
    echo "⚠️  Realtime service may have issues (this is OK if no API keys configured)"
fi

# Start main app
echo "🌐 Starting Next.js on port 3000..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🎉 Meeting Copilot is running!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  📱 App:        http://localhost:3000"
echo "  🔌 WebSocket:  ws://localhost:3003"
echo ""
echo "  Test Accounts:"
echo "    Admin: admin@meetingcopilot.com / admin123"
echo "    Demo:  demo@meetingcopilot.com / demo123"
echo ""
echo "  Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════════════"
echo ""

bunx next dev -p 3000
