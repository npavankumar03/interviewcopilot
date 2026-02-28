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
    export PATH="$HOME/.bun/bin:$PATH"
    
    # Add to shell profile
    if [ -f "$HOME/.bashrc" ]; then
        echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.bashrc"
    fi
    if [ -f "$HOME/.zshrc" ]; then
        echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.zshrc"
    fi
fi
print_success "Bun is installed"

print_success "All requirements met!"

# ============================================
# CLONE REPOSITORY
# ============================================

print_step "Cloning Meeting Copilot repository..."

INSTALL_DIR="${INSTALL_DIR:-$HOME/meeting-copilot}"

if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        print_error "Installation cancelled"
        exit 1
    fi
fi

git clone https://github.com/npavankumar03/interviewcopilot.git "$INSTALL_DIR"
cd "$INSTALL_DIR"
print_success "Repository cloned to $INSTALL_DIR"

# ============================================
# INSTALL DEPENDENCIES
# ============================================

print_step "Installing dependencies..."

bun install

# Install realtime service dependencies
cd mini-services/realtime-service
bun install
cd ../..

print_success "Dependencies installed"

# ============================================
# CONFIGURE ENVIRONMENT
# ============================================

print_step "Configuring environment..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "Created .env file from template"
    
    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
    if [ -n "$JWT_SECRET" ]; then
        sed -i "s/change-me-to-a-secure-random-string-in-production/$JWT_SECRET/" .env 2>/dev/null || \
        sed -i '' "s/change-me-to-a-secure-random-string-in-production/$JWT_SECRET/" .env 2>/dev/null || \
        print_warning "Could not set JWT secret automatically"
    fi
    
    print_warning ""
    print_warning "═══════════════════════════════════════════════════════════" "$YELLOW"
    print_warning "  IMPORTANT: Edit .env file and add your API keys!" "$YELLOW"
    print_warning "═══════════════════════════════════════════════════════════" "$YELLOW"
    print_warning ""
    print_warning "Required keys:" "$YELLOW"
    print_warning "  - OPENAI_API_KEY or GEMINI_API_KEY (for LLM)" "$YELLOW"
    print_warning "  - AZURE_SPEECH_KEY + AZURE_REGION (for STT, optional)" "$YELLOW"
    print_warning ""
    print_warning "File location: $INSTALL_DIR/.env" "$YELLOW"
else
    print_success ".env file already exists"
fi

# ============================================
# SETUP DATABASE
# ============================================

print_step "Setting up database..."

bun run db:push
print_success "Database schema created"

bun run db:seed
print_success "Database seeded with initial data"

# ============================================
# CREATE START SCRIPTS
# ============================================

print_step "Creating start scripts..."

# Create start script
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting Meeting Copilot..."

# Start realtime service in background
cd mini-services/realtime-service
bun run dev &
REALTIME_PID=$!
cd ../..

# Wait for realtime service to start
sleep 2

# Start main application
bun run dev

# Cleanup on exit
trap "kill $REALTIME_PID 2>/dev/null" EXIT
EOF
chmod +x "$INSTALL_DIR/start.sh"

# Create stop script
cat > "$INSTALL_DIR/stop.sh" << 'EOF'
#!/bin/bash
echo "🛑 Stopping Meeting Copilot..."
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
echo "✓ Meeting Copilot stopped"
EOF
chmod +x "$INSTALL_DIR/stop.sh"

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

print_msg "Installation directory: " "$CYAN"
echo "$INSTALL_DIR"

echo ""
print_msg "Test Accounts:" "$CYAN"
echo "  Admin: admin@meetingcopilot.com / admin123"
echo "  Demo:  demo@meetingcopilot.com / demo123"

echo ""
print_msg "Quick Start:" "$CYAN"
echo "  1. cd $INSTALL_DIR"
echo "  2. Edit .env and add your API keys"
echo "  3. ./start.sh"
echo "  4. Open http://localhost:3000 in your browser"

echo ""
print_msg "Commands:" "$CYAN"
echo "  ./start.sh   - Start the application"
echo "  ./stop.sh    - Stop the application"
echo "  ./update.sh  - Update to latest version"
echo ""
