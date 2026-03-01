#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Installer
# ============================================
# Usage: curl -fsSL https://raw.githubusercontent.com/npavankumar03/interviewcopilot/master/install.sh | bash

set -e

# Colors
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
C='\033[0;36m'
NC='\033[0m'

msg() { echo -e "${2}${1}${NC}"; }
step() { echo ""; msg "▶ $1" "$C"; }
ok() { msg "✓ $1" "$G"; }
err() { msg "✗ $1" "$R"; }
warn() { msg "⚠ $1" "$Y"; }

# ============================================
clear
echo ""
msg "╔═══════════════════════════════════════════════════════════╗" "$B"
msg "║         🎙️  Meeting Copilot - Installer                   ║" "$B"
msg "╚═══════════════════════════════════════════════════════════╝" "$B"
echo ""

# ============================================
# REQUIREMENTS
# ============================================

step "Checking requirements..."

# curl
command -v curl >/dev/null 2>&1 || { 
    warn "Installing curl..."
    sudo apt-get update && sudo apt-get install -y curl 2>/dev/null || \
    sudo yum install -y curl 2>/dev/null || \
    { err "Please install curl"; exit 1; }
}
ok "curl"

# git
command -v git >/dev/null 2>&1 || {
    warn "Installing git..."
    sudo apt-get install -y git 2>/dev/null || \
    sudo yum install -y git 2>/dev/null || \
    { err "Please install git"; exit 1; }
}
ok "git"

# Node.js
if ! command -v node >/dev/null 2>&1; then
    warn "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null && \
    sudo apt-get install -y nodejs 2>/dev/null || \
    { err "Please install Node.js 20+ manually"; exit 1; }
fi
ok "Node.js $(node -v)"

# Bun
if ! command -v bun >/dev/null 2>&1; then
    warn "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$PATH"
ok "Bun $(bun -v)"

# ============================================
# CLONE
# ============================================

step "Cloning repository..."

INSTALL_DIR="${INSTALL_DIR:-$HOME/meeting-copilot}"
REPO_URL="https://github.com/npavankumar03/interviewcopilot.git"

# Remove existing if present
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"

# Clone
git clone "$REPO_URL" "$INSTALL_DIR"
ok "Cloned to $INSTALL_DIR"

# Enter directory
cd "$INSTALL_DIR" || { err "Cannot enter $INSTALL_DIR"; exit 1; }

# Check package.json
if [ ! -f "package.json" ]; then
    err "package.json NOT FOUND"
    exit 1
fi
ok "Found package.json"

# ============================================
# INSTALL
# ============================================

step "Installing dependencies..."

BUN="$HOME/.bun/bin/bun"
[ ! -f "$BUN" ] && BUN="bun"

"$BUN" install || { err "Install failed"; exit 1; }

# Realtime service
if [ -d "mini-services/realtime-service" ]; then
    msg "Installing realtime service..." "$Y"
    cd mini-services/realtime-service
    "$BUN" install || true
    cd "$INSTALL_DIR"
fi
ok "Dependencies installed"

# ============================================
# CONFIG
# ============================================

step "Configuring..."

# Create db directory
mkdir -p db

# Create .env if not exists
if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
# Meeting Copilot SaaS - Environment Variables
# Add your API keys below

# Database
DATABASE_URL="file:./db/meeting-copilot.db"

# Authentication
JWT_SECRET="change-me-to-a-secure-random-string-in-production"

# OpenAI API (Required for AI features)
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# Google Gemini API (Alternative to OpenAI)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.0-flash"

# Azure Speech Services
AZURE_SPEECH_KEY="your-azure-speech-key"
AZURE_REGION="eastus"

# Application Settings
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Meeting Copilot"
ENVEOF

    # Generate JWT secret
    SECRET=$(openssl rand -hex 32 2>/dev/null || echo "secret-$(date +%s)")
    sed -i "s/change-me-to-a-secure-random-string-in-production/$SECRET/" .env 2>/dev/null || true
    ok "Created .env"
fi

# ============================================
# DATABASE
# ============================================

step "Setting up database..."

# Set absolute database path
export DATABASE_URL="file:$(pwd)/db/meeting-copilot.db"
echo "Database: $DATABASE_URL"

"$BUN" run db:push || { err "db:push failed"; exit 1; }
ok "Schema created"

"$BUN" run db:seed || { err "db:seed failed"; exit 1; }
ok "Data seeded"

# ============================================
# START SCRIPT
# ============================================

step "Creating start script..."

cat > "$INSTALL_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"

echo ""
echo "🚀 Starting Meeting Copilot..."
echo ""

# Check .env
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file!"
    exit 1
fi

# Create db directory
mkdir -p db

# Set absolute database path
export DATABASE_URL="file:$(pwd)/db/meeting-copilot.db"
echo "📁 Database: $DATABASE_URL"

# Check if database exists
if [ ! -f "db/meeting-copilot.db" ]; then
    echo "📊 Creating database..."
    bun run db:push
    bun run db:seed
fi

# Regenerate Prisma client
bun run db:generate 2>/dev/null || true

# Kill existing processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
sleep 1

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping..."
    pkill -f "bun --hot" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    echo "✓ Stopped"
}
trap cleanup EXIT

# Start realtime service
echo "📡 Starting realtime service on port 3003..."
cd mini-services/realtime-service
DATABASE_URL="$DATABASE_URL" bun --hot src/index.ts &
cd ../..
sleep 3

# Start main app
echo "🌐 Starting Next.js on port 3000..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🎉 Meeting Copilot is running!"
echo "═══════════════════════════════════════════════════════════"
echo "  📱 http://localhost:3000"
echo "  📧 admin@meetingcopilot.com / admin123"
echo "═══════════════════════════════════════════════════════════"
bunx next dev -p 3000
STARTEOF

chmod +x "$INSTALL_DIR/start.sh"
ok "Start script created"

# ============================================
# DONE
# ============================================

echo ""
msg "╔═══════════════════════════════════════════════════════════╗" "$G"
msg "║           ✅ Installation Complete!                       ║" "$G"
msg "╚═══════════════════════════════════════════════════════════╝" "$G"
echo ""

msg "📁 Directory: $INSTALL_DIR" "$C"
echo ""
msg "🚀 To start:" "$C"
echo "  cd $INSTALL_DIR"
echo "  nano .env    # Add your API keys"
echo "  ./start.sh"
echo ""
