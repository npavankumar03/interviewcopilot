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

# Debug - show what we got
msg "Files in $(pwd):" "$Y"
ls -la | head -20

# Check package.json
if [ ! -f "package.json" ]; then
    err "package.json NOT FOUND in $(pwd)"
    err "Clone may have failed"
    exit 1
fi
ok "Found package.json"

# ============================================
# INSTALL
# ============================================

step "Installing dependencies..."

BUN="$HOME/.bun/bin/bun"
[ ! -f "$BUN" ] && BUN="bun"

msg "Running: $BUN install" "$Y"
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

if [ ! -f ".env" ]; then
    cp .env.example .env
    # Generate JWT secret
    SECRET=$(openssl rand -hex 32 2>/dev/null || echo "secret-$(date +%s)")
    sed -i "s/change-me-to-a-secure-random-string-in-production/$SECRET/" .env 2>/dev/null || \
    sed -i '' "s/change-me-to-a-secure-random-string-in-production/$SECRET/" .env 2>/dev/null || true
    ok "Created .env"
fi

warn ""
warn "═══════════════════════════════════════════════════════════"
warn "  EDIT .env AND ADD YOUR API KEYS!"
warn "═══════════════════════════════════════════════════════════"
warn "  Required: OPENAI_API_KEY or GEMINI_API_KEY"
warn "  Location: $INSTALL_DIR/.env"
warn ""

# ============================================
# DATABASE
# ============================================

step "Setting up database..."

"$BUN" run db:push || { err "db:push failed"; exit 1; }
ok "Schema created"

"$BUN" run db:seed || { err "db:seed failed"; exit 1; }
ok "Data seeded"

# ============================================
# START SCRIPTS
# ============================================

step "Creating start scripts..."

cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"
echo "🚀 Starting Meeting Copilot..."

# Realtime service
if [ -d "mini-services/realtime-service" ]; then
    cd mini-services/realtime-service && bun run dev &
    cd ../..
    sleep 2
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🎉 Running at http://localhost:3000"
echo "  📧 admin@meetingcopilot.com / admin123"
echo "═══════════════════════════════════════════════════════════"
bun run dev
EOF

cat > "$INSTALL_DIR/stop.sh" << 'EOF'
#!/bin/bash
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
echo "✓ Stopped"
EOF

chmod +x "$INSTALL_DIR/start.sh" "$INSTALL_DIR/stop.sh" 2>/dev/null || true
ok "Scripts created"

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
msg "🚀 Start:" "$C"
echo "  cd $INSTALL_DIR"
echo "  nano .env    # Add API keys"
echo "  ./start.sh"
echo ""
msg "📦 Update:" "$C"
echo "  cd $INSTALL_DIR && ./update.sh"
echo ""
