#!/bin/bash

# ============================================
# Meeting Copilot SaaS - Update Script
# ============================================
# Run this script to update to the latest version
# Usage: curl -fsSL https://raw.githubusercontent.com/npavankumar03/interviewcopilot/master/update.sh | bash

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

# ============================================
# START UPDATE
# ============================================

clear
echo ""
print_msg "╔═══════════════════════════════════════════════════════════╗" "$BLUE"
print_msg "║                                                           ║" "$BLUE"
print_msg "║         🔄 Meeting Copilot SaaS - Updater                 ║" "$BLUE"
print_msg "║                                                           ║" "$BLUE"
print_msg "╚═══════════════════════════════════════════════════════════╝" "$BLUE"
echo ""

# ============================================
# FIND INSTALLATION DIRECTORY
# ============================================

INSTALL_DIR="${INSTALL_DIR:-$HOME/meeting-copilot}"

# Try to find installation directory
if [ ! -d "$INSTALL_DIR/.git" ]; then
    # Check common locations
    for dir in "$HOME/meeting-copilot" "$HOME/interviewcopilot" "$HOME/copilot" "$(pwd)"; do
        if [ -d "$dir/.git" ]; then
            INSTALL_DIR="$dir"
            break
        fi
    done
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
    print_error "Meeting Copilot installation not found!"
    echo ""
    echo "Please either:"
    echo "  1. Run this script from the installation directory"
    echo "  2. Set INSTALL_DIR environment variable:"
    echo "     INSTALL_DIR=/path/to/copilot ./update.sh"
    echo ""
    echo "Or run install.sh first:"
    echo "  curl -fsSL https://raw.githubusercontent.com/npavankumar03/interviewcopilot/master/install.sh | bash"
    exit 1
fi

print_msg "Installation directory: " "$CYAN"
echo "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ============================================
# CHECK FOR CHANGES
# ============================================

print_step "Checking for updates..."

# Fetch latest changes
git fetch origin

# Check if we're behind
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master 2>/dev/null || git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
    print_success "Already up to date!"
    echo ""
    print_msg "Current version: " "$CYAN"
    git log -1 --format="%h - %s (%cr)"
    exit 0
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes!"
    echo ""
    git status --short
    echo ""
    read -p "Stash changes and continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash push -m "Auto-stash before update at $(date)"
        print_success "Changes stashed"
        STASHED=true
    else
        print_error "Update cancelled"
        exit 1
    fi
fi

# ============================================
# STOP SERVICES
# ============================================

print_step "Stopping running services..."

# Kill any running processes
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true

sleep 1
print_success "Services stopped"

# ============================================
# BACKUP
# ============================================

print_step "Creating backup..."

BACKUP_DIR="$INSTALL_DIR.backup.$(date +%Y%m%d_%H%M%S)"

# Backup .env and database
mkdir -p "$BACKUP_DIR"
[ -f ".env" ] && cp ".env" "$BACKUP_DIR/"
[ -d "db" ] && cp -r "db" "$BACKUP_DIR/"
[ -f "prisma/dev.db" ] && cp "prisma/dev.db" "$BACKUP_DIR/" 2>/dev/null || true

print_success "Backup created at $BACKUP_DIR"

# ============================================
# PULL LATEST CHANGES
# ============================================

print_step "Pulling latest changes..."

git pull origin master 2>/dev/null || git pull origin main

print_success "Code updated"

# Show what changed
echo ""
print_msg "Changes:" "$CYAN"
git log --oneline $LOCAL..HEAD 2>/dev/null || git log --oneline -5
echo ""

# ============================================
# UPDATE DEPENDENCIES
# ============================================

print_step "Updating dependencies..."

bun install

# Update realtime service
cd mini-services/realtime-service
bun install
cd ../..

print_success "Dependencies updated"

# ============================================
# UPDATE DATABASE SCHEMA
# ============================================

print_step "Updating database schema..."

bun run db:push 2>/dev/null || true

print_success "Database schema updated"

# ============================================
# RESTORE CONFIGURATION
# ============================================

print_step "Restoring configuration..."

# Restore .env if not present
if [ ! -f ".env" ] && [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" ".env"
    print_success ".env restored from backup"
fi

# Restore database if needed
if [ -f "$BACKUP_DIR/custom.db" ] && [ ! -f "db/custom.db" ]; then
    cp "$BACKUP_DIR/custom.db" "db/custom.db"
    print_success "Database restored from backup"
fi

# ============================================
# CLEANUP OLD BACKUPS
# ============================================

# Keep only last 5 backups
BACKUP_COUNT=$(ls -d "$INSTALL_DIR".backup.* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 5 ]; then
    print_step "Cleaning up old backups..."
    ls -d "$INSTALL_DIR".backup.* | head -n -5 | xargs rm -rf
    print_success "Old backups cleaned"
fi

# ============================================
# UPDATE COMPLETE
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

print_msg "Backup saved to: " "$CYAN"
echo "$BACKUP_DIR"

echo ""
print_msg "Ready to start:" "$CYAN"
echo "  cd $INSTALL_DIR && ./start.sh"
echo ""

# Pop stash if we stashed
if [ "$STASHED" = true ]; then
    print_warning "You have stashed changes. To restore them:"
    echo "  git stash pop"
    echo ""
fi
