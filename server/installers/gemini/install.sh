#!/bin/bash

# ============================================================================
# Gemini CLI installer — on-demand installation from Settings UI
# ============================================================================
# Installs Gemini CLI via npm global package. Idempotent: skips if already
# installed. Requires Node.js (already present in the container image).

set -euo pipefail

USER_HOME="${HOME}"

# Check known global install locations only — not command -v, which could
# find binaries from node_modules/.bin/ when run under npm.
for bin in /usr/local/bin/gemini /usr/bin/gemini; do
    if [ -x "$bin" ]; then
        echo "Gemini CLI already installed."
        "$bin" --version 2>/dev/null || true
        exit 0
    fi
done

# Ensure python3 is available (required by node-gyp for native modules).
if ! command -v python3 &>/dev/null; then
    echo "Installing prerequisite: python3..."
    sudo apt-get update -qq && sudo apt-get install -y --no-install-recommends python3 \
        && sudo rm -rf /var/lib/apt/lists/*
fi

echo "Installing Gemini CLI..."
if [ -w "$(npm root -g)" ] 2>/dev/null; then
    npm install -g @google/gemini-cli
else
    sudo npm install -g @google/gemini-cli
fi

# Pre-create data directory to avoid ENOENT on first run.
mkdir -p "$USER_HOME/.gemini"

echo "Gemini CLI installed successfully."
gemini --version 2>/dev/null || true
