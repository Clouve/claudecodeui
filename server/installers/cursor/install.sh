#!/bin/bash

# ============================================================================
# Cursor CLI installer — on-demand installation from Settings UI
# ============================================================================
# Installs Cursor Agent for the current user. Idempotent: skips if already
# installed. Binary lands in ~/.local/bin/agent with a symlink in
# /usr/local/bin/ for universal PATH access.

set -euo pipefail

USER_HOME="${HOME}"

if [ -x "$USER_HOME/.local/bin/agent" ]; then
    echo "Cursor CLI already installed."
    agent --version 2>/dev/null || true
    exit 0
fi

echo "Installing Cursor CLI..."
export PATH="$HOME/.local/bin:$PATH"
curl -fsS https://cursor.com/install | bash

if [ ! -x "$USER_HOME/.local/bin/agent" ]; then
    echo "ERROR: Cursor CLI installation failed — binary not found."
    exit 1
fi

# Symlink into system PATH for non-login shells.
if [ -w /usr/local/bin ] || command -v sudo &>/dev/null; then
    sudo ln -sf "$USER_HOME/.local/bin/agent" /usr/local/bin/agent 2>/dev/null || true
fi

# Pre-create data directories to prevent EACCES on first run.
mkdir -p "$USER_HOME/.cursor/projects"

echo "Cursor CLI installed successfully."
agent --version 2>/dev/null || true
