#!/bin/bash

# ============================================================================
# Claude Code installer — on-demand installation from Settings UI
# ============================================================================
# Installs Claude Code for the current user. Idempotent: skips if already
# installed. Binary lands in ~/.local/bin/claude with a symlink in
# /usr/local/bin/ for universal PATH access.

set -euo pipefail

USER_HOME="${HOME}"

if [ -x "$USER_HOME/.local/bin/claude" ]; then
    echo "Claude Code already installed."
    claude --version 2>/dev/null || true
    exit 0
fi

echo "Installing Claude Code..."
export PATH="$HOME/.local/bin:$PATH"
curl -fsSL https://claude.ai/install.sh | bash

if [ ! -x "$USER_HOME/.local/bin/claude" ]; then
    echo "ERROR: Claude Code installation failed — binary not found."
    exit 1
fi

# Symlink into system PATH for non-login shells.
if [ -w /usr/local/bin ] || command -v sudo &>/dev/null; then
    sudo ln -sf "$USER_HOME/.local/bin/claude" /usr/local/bin/claude 2>/dev/null || true
fi

# Skip first-run onboarding wizard.
if command -v jq &>/dev/null; then
    echo '{}' | jq '.hasCompletedOnboarding = true | .oauthAccount = null' \
        > "$USER_HOME/.claude.json" && chmod 600 "$USER_HOME/.claude.json"
fi

echo "Claude Code installed successfully."
claude --version 2>/dev/null || true
