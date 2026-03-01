#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Stop Script
# ============================================

echo ""
echo "🛑 Stopping Meeting Copilot..."
echo ""

# Kill all related processes
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true

# Give processes time to stop
sleep 1

# Check if anything is still running
if pgrep -f "bun run dev" > /dev/null 2>&1; then
    echo "⚠️  Some processes may still be running"
    pkill -9 -f "bun run dev" 2>/dev/null || true
fi

if pgrep -f "next dev" > /dev/null 2>&1; then
    echo "⚠️  Some Next.js processes may still be running"
    pkill -9 -f "next dev" 2>/dev/null || true
fi

echo "✓ Meeting Copilot stopped"
echo ""
