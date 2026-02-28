#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Update Script
# ============================================
# Run this script to update to the latest version
# Usage: cd meeting-copilot && ./update.sh

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

print_step() {
    echo ""
    print_msg "▶ $1" "$CYAN"
}

print_success() {
    print_msg "✓ $1" "$GREEN"
}

print_error() {
    print_msg "✗ $1" "$RED"
}

print_warning() {
    print_msg "⚠ $1" "$YELLOW"
}

# ============================================
# START UPDATE
# ============================================

clear
echo ""
print_msg "╔═══════════════════════════════════════════════════════════╗" "$BLUE"
print_msg "║                                                           ║" "$BLUE"
print_msg "║         🔄 Meeting Copilot - Updater                      ║" "$BLUE"
print_msg "║                                                           ║" "$BLUE"
print_msg "╚═══════════════════════════════════════════════════════════╝" "$BLUE"
echo ""

# ============================================
# FIND INSTALLATION
# ============================================

INSTALL_DIR="${INSTALL_DIR:-$(pwd)}"

# Check if we're in the right directory
if [ ! -f "$INSTALL_DIR/package.json" ] || [ ! -d "$INSTALL_DIR/.git" ]; then
    # Try common locations
    for dir in "$HOME/meeting-copilot" "$HOME/interviewcopilot" "$(dirname "$0")"; do
        if [ -f "$dir/package.json" ] && [ -d "$dir/.git" ]; then
            INSTALL_DIR="$dir"
            break
        fi
    done
fi

if [ ! -f "$INSTALL_DIR/package.json" ]; then
    print_error "Meeting Copilot installation not found!"
    echo ""
    echo "Please either:"
    echo "  1. Run this script from the installation directory"
    echo "  2. Set INSTALL_DIR variable: INSTALL_DIR=/path/to/app ./update.sh"
    exit 1
fi

cd "$INSTALL_DIR"
print_msg "📁 Installation: $INSTALL_DIR" "$CYAN"

# ============================================
# CHECK FOR UPDATES
# ============================================

print_step "Checking for updates..."

# Ensure bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Fetch latest
git fetch origin master 2>/dev/null || git fetch origin main 2>/dev/null || true

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/master 2>/dev/null || git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
    print_success "Already up to date!"
    git log -1 --format="%h - %s (%cr)"
    exit 0
fi

echo ""
print_msg "New version available!" "$GREEN"
git log --oneline $LOCAL..$REMOTE 2>/dev/null || git log --oneline -5
echo ""

# ============================================
# BACKUP
# ============================================

print_step "Creating backup..."

BACKUP_DIR="$INSTALL_DIR/.backup.$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

[ -f ".env" ] && cp ".env" "$BACKUP_DIR/"
[ -d "db" ] && cp -r "db" "$BACKUP_DIR/" 2>/dev/null || true

print_success "Backup saved to $BACKUP_DIR"

# ============================================
# STOP SERVICES
# ============================================

print_step "Stopping services..."

pkill -f "bun run dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

sleep 1
print_success "Services stopped"

# ============================================
# STASH CHANGES
# ============================================

STASHED=false
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    print_warning "Uncommitted changes detected, stashing..."
    git stash push -m "Auto-stash before update $(date)"
    STASHED=true
fi

# ============================================
# PULL UPDATES
# ============================================

print_step "Pulling updates..."

git pull origin master 2>/dev/null || git pull origin main 2>/dev/null || \
    { print_error "Pull failed"; exit 1; }

print_success "Code updated"

# Restore stashed changes
if [ "$STASHED" = true ]; then
    print_warning "Restoring stashed changes..."
    git stash pop 2>/dev/null || print_warning "Could not restore stash"
fi

# ============================================
# UPDATE DEPENDENCIES
# ============================================

print_step "Updating dependencies..."

BUN_BIN="$HOME/.bun/bin/bun"
[ ! -f "$BUN_BIN" ] && BUN_BIN="bun"

"$BUN_BIN" install 2>&1 || { print_error "Dependency update failed"; exit 1; }

# Update realtime service
if [ -d "mini-services/realtime-service" ]; then
    cd mini-services/realtime-service
    "$BUN_BIN" install 2>&1 || true
    cd "$INSTALL_DIR"
fi

print_success "Dependencies updated"

# ============================================
# UPDATE DATABASE
# ============================================

print_step "Updating database..."

"$BUN_BIN" run db:push 2>&1 || true

print_success "Database schema updated"

# ============================================
# RESTORE CONFIG
# ============================================

if [ -f "$BACKUP_DIR/.env" ] && [ ! -f ".env" ]; then
    cp "$BACKUP_DIR/.env" ".env"
    print_success "Restored .env from backup"
fi

# ============================================
# CLEANUP OLD BACKUPS
# ============================================

# Keep only last 3 backups
BACKUP_COUNT=$(ls -d "$INSTALL_DIR"/.backup.* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 3 ]; then
    ls -dt "$INSTALL_DIR"/.backup.* | tail -n +4 | xargs rm -rf 2>/dev/null || true
fi

# ============================================
# COMPLETE
# ============================================

echo ""
print_msg "╔═══════════════════════════════════════════════════════════╗" "$GREEN"
print_msg "║                                                           ║" "$GREEN"
print_msg "║           ✅ Update Complete!                             ║" "$GREEN"
print_msg "║                                                           ║" "$GREEN"
print_msg "╚═══════════════════════════════════════════════════════════╝" "$GREEN"
echo ""

print_msg "Version: " "$CYAN"
git log -1 --format="%h - %s (%cr)"
echo ""

print_msg "🚀 Ready to start: ./start.sh" "$GREEN"
echo ""
