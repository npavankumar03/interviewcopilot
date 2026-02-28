#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Installation Script
# ============================================
# Run this script for first-time installation
# Usage: curl -fsSL https://raw.githubusercontent.com/npavankumar03/interviewcopilot/master/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored message
print_msg() {
    echo -e "${2}${1}${NC}"
}

# Print step
print_step() {
    echo ""
    print_msg "▶ $1" "$CYAN"
}

# Print success
print_success() {
    print_msg "✓ $1" "$GREEN"
}

# Print error
print_error() {
    print_msg "✗ $1" "$RED"
}

# Print warning
print_warning() {
    print_msg "⚠ $1" "$YELLOW"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================
# START INSTALLATION
# ============================================

clear
echo ""
print_msg "╔═══════════════════════════════════════════════════════════╗" "$BLUE"
print_msg "║                                                           ║" "$BLUE"
print_msg "║         🎙️  Meeting Copilot SaaS - Installer              ║" "$BLUE"
print_msg "║                                                           ║" "$BLUE"
print_msg "╚═══════════════════════════════════════════════════════════╝" "$BLUE"
echo ""

# ============================================
# CHECK REQUIREMENTS
# ============================================

print_step "Checking requirements..."

# Check OS
OS="$(uname -s)"
case "$OS" in
    Linux*)  print_success "OS: Linux" ;;
    Darwin*) print_success "OS: macOS" ;;
    *)       print_warning "OS: $OS (not officially tested)" ;;
esac

# Check for package manager
if command_exists apt-get; then
    PKG_MANAGER="apt-get"
elif command_exists yum; then
    PKG_MANAGER="yum"
elif command_exists dnf; then
    PKG_MANAGER="dnf"
elif command_exists brew; then
    PKG_MANAGER="brew"
else
    PKG_MANAGER="none"
fi

# Check curl
if ! command_exists curl; then
    print_warning "curl not found, installing..."
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        sudo apt-get update && sudo apt-get install -y curl
    elif [ "$PKG_MANAGER" = "yum" ]; then
        sudo yum install -y curl
    elif [ "$PKG_MANAGER" = "dnf" ]; then
        sudo dnf install -y curl
    elif [ "$PKG_MANAGER" = "brew" ]; then
        brew install curl
    else
        print_error "Please install curl manually"
        exit 1
    fi
fi
print_success "curl is installed"

# Check git
if ! command_exists git; then
    print_warning "git not found, installing..."
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        sudo apt-get update && sudo apt-get install -y git
    elif [ "$PKG_MANAGER" = "yum" ]; then
        sudo yum install -y git
    elif [ "$PKG_MANAGER" = "dnf" ]; then
        sudo dnf install -y git
    elif [ "$PKG_MANAGER" = "brew" ]; then
        brew install git
    else
        print_error "Please install git manually"
        exit 1
    fi
fi
print_success "git is installed"

# Check Node.js
if ! command_exists node; then
    print_warning "Node.js not found, installing..."
    if [ "$PKG_MANAGER" = "brew" ]; then
        brew install node
    else
        # Install Node.js 20.x via NodeSource
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || \
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || \
        { print_error "Please install Node.js 20+ manually"; exit 1; }
        
        if [ "$PKG_MANAGER" = "apt-get" ]; then
            sudo apt-get install -y nodejs
        elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
            sudo $PKG_MANAGER install -y nodejs
        fi
    fi
fi
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ "${NODE_VERSION:-0}" -lt 18 ]; then
    print_error "Node.js version must be 18+. Current: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) is installed"

# Check Bun
if ! command_exists bun; then
    print_warning "Bun not found, installing..."
    curl -fsSL https://bun.sh/install | bash
    
    # Add to shell profile (avoid duplicates)
    if [ -f "$HOME/.bashrc" ]; then
        grep -q '.bun/bin' "$HOME/.bashrc" 2>/dev/null || \
            echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.bashrc"
    fi
    if [ -f "$HOME/.zshrc" ]; then
        grep -q '.bun/bin' "$HOME/.zshrc" 2>/dev/null || \
            echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.zshrc"
    fi
fi

# Ensure bun is in PATH for this session
export PATH="$HOME/.bun/bin:$PATH"

# Verify bun is available
if ! command -v bun >/dev/null 2>&1; then
    print_error "Bun installation failed"
    print_error "Please install manually: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

print_success "Bun is installed ($(bun -v))"
print_success "All requirements met!"

# ============================================
# CLONE REPOSITORY
# ============================================

print_step "Cloning Meeting Copilot repository..."

INSTALL_DIR="${INSTALL_DIR:-$HOME/meeting-copilot}"
REPO_URL="https://github.com/npavankumar03/interviewcopilot.git"

if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    print_warning "Remove it to reinstall fresh"
    rm -rf "$INSTALL_DIR"
fi

git clone "$REPO_URL" "$INSTALL_DIR"

# Verify clone succeeded
if [ ! -d "$INSTALL_DIR" ]; then
    print_error "Clone failed - directory not created"
    exit 1
fi

cd "$INSTALL_DIR" || { print_error "Failed to enter directory"; exit 1; }

print_success "Repository cloned to $INSTALL_DIR"

# Verify package.json exists (give a moment for filesystem)
sleep 1

if [ ! -f "package.json" ]; then
    print_error "package.json not found!"
    print_error "Files in directory:"
    ls -la
    exit 1
fi

print_success "Found package.json"

# ============================================
# INSTALL DEPENDENCIES
# ============================================

print_step "Installing dependencies..."

print_msg "Working directory: $(pwd)" "$YELLOW"
print_msg "Installing main dependencies..." "$YELLOW"

# Use full path to bun
BUN_BIN="$HOME/.bun/bin/bun"

if [ ! -f "$BUN_BIN" ]; then
    BUN_BIN="bun"
fi

"$BUN_BIN" install 2>&1 || { print_error "Failed to install main dependencies"; exit 1; }

# Install realtime service dependencies
if [ -d "mini-services/realtime-service" ]; then
    print_msg "Installing realtime service dependencies..." "$YELLOW"
    cd mini-services/realtime-service
    "$BUN_BIN" install 2>&1 || { print_error "Failed to install realtime dependencies"; exit 1; }
    cd "$INSTALL_DIR"
fi

print_success "Dependencies installed"

# ============================================
# CONFIGURE ENVIRONMENT
# ============================================

print_step "Configuring environment..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "Created .env file from template"
    
    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32 2>/dev/null || echo "change-me-$(date +%s)")
    
    if [ -n "$JWT_SECRET" ]; then
        # Try different sed syntaxes for macOS/Linux
        if sed -i "s/change-me-to-a-secure-random-string-in-production/$JWT_SECRET/" .env 2>/dev/null; then
            print_success "JWT secret generated"
        elif sed -i '' "s/change-me-to-a-secure-random-string-in-production/$JWT_SECRET/" .env 2>/dev/null; then
            print_success "JWT secret generated"
        else
            print_warning "Could not set JWT secret automatically"
        fi
    fi
    
    print_warning ""
    print_warning "═══════════════════════════════════════════════════════════" 
    print_warning "  IMPORTANT: Edit .env file and add your API keys!" 
    print_warning "═══════════════════════════════════════════════════════════"
    print_warning ""
    print_warning "Required keys:"
    print_warning "  - OPENAI_API_KEY or GEMINI_API_KEY (for LLM)"
    print_warning "  - AZURE_SPEECH_KEY + AZURE_REGION (for STT, optional)"
    print_warning ""
    print_warning "File location: $INSTALL_DIR/.env"
else
    print_success ".env file already exists"
fi

# ============================================
# SETUP DATABASE
# ============================================

print_step "Setting up database..."

"$BUN_BIN" run db:push 2>&1 || { print_error "Database push failed"; exit 1; }
print_success "Database schema created"

"$BUN_BIN" run db:seed 2>&1 || { print_error "Database seed failed"; exit 1; }
print_success "Database seeded with initial data"

# ============================================
# CREATE START SCRIPTS
# ============================================

print_step "Creating start scripts..."

# Create start script
cat > "$INSTALL_DIR/start.sh" << 'STARTSCRIPT'
#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "🚀 Starting Meeting Copilot..."
echo ""

# Check .env
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    echo "📝 Creating from template..."
    cp .env.example .env
    echo "Please edit .env and add your API keys, then run ./start.sh again"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    pkill -f "bun --hot" 2>/dev/null || true
    echo "✓ Stopped"
}
trap cleanup EXIT

# Ensure bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Start realtime service
echo "📡 Starting realtime service on port 3003..."
if [ -d "mini-services/realtime-service" ]; then
    cd mini-services/realtime-service
    bun run dev &
    cd ../..
    sleep 2
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

bun run dev
STARTSCRIPT
chmod +x "$INSTALL_DIR/start.sh" 2>/dev/null || true

# Create stop script
cat > "$INSTALL_DIR/stop.sh" << 'STOPSCRIPT'
#!/bin/bash
echo "🛑 Stopping Meeting Copilot..."
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
echo "✓ Meeting Copilot stopped"
STOPSCRIPT
chmod +x "$INSTALL_DIR/stop.sh" 2>/dev/null || true

print_success "Start/stop scripts created"

# ============================================
# INSTALLATION COMPLETE
# ============================================

echo ""
print_msg "╔═══════════════════════════════════════════════════════════╗" "$GREEN"
print_msg "║                                                           ║" "$GREEN"
print_msg "║           ✅ Installation Complete!                       ║" "$GREEN"
print_msg "║                                                           ║" "$GREEN"
print_msg "╚═══════════════════════════════════════════════════════════╝" "$GREEN"
echo ""

print_msg "📁 Installation directory: " "$CYAN"
echo "$INSTALL_DIR"

echo ""
print_msg "👤 Test Accounts:" "$CYAN"
echo "  Admin: admin@meetingcopilot.com / admin123"
echo "  Demo:  demo@meetingcopilot.com / demo123"

echo ""
print_msg "🚀 Quick Start:" "$CYAN"
echo "  cd $INSTALL_DIR"
echo "  nano .env        # Add your API keys"
echo "  ./start.sh       # Start the app"

echo ""
print_msg "📚 Commands:" "$CYAN"
echo "  ./start.sh   - Start the application"
echo "  ./stop.sh    - Stop the application"
echo "  ./update.sh  - Update to latest version"
echo ""
