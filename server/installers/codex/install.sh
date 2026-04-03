#!/bin/bash

# ============================================================================
# OpenAI Codex CLI installer — on-demand installation from Settings UI
# ============================================================================
# Installs Codex CLI via npm global package. Idempotent: skips if already
# installed. Requires Node.js 22+ (already present in the container image).

set -euo pipefail

# Check known global install locations only — not command -v, which would
# find node_modules/.bin/codex from the project SDK dependency.
for bin in /usr/local/bin/codex /usr/bin/codex; do
    if [ -x "$bin" ]; then
        echo "Codex CLI already installed."
        "$bin" --version 2>/dev/null || true
        exit 0
    fi
done

echo "Installing OpenAI Codex CLI..."
if [ -w "$(npm root -g)" ] 2>/dev/null; then
    npm install -g @openai/codex
else
    sudo npm install -g @openai/codex
fi

echo "Codex CLI installed successfully."
codex --version 2>/dev/null || true
