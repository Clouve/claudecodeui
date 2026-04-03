#!/bin/bash

# ============================================================================
# OpenAI Codex CLI uninstaller
# ============================================================================

set -euo pipefail

echo "Uninstalling OpenAI Codex CLI..."

if [ -w "$(npm root -g)" ] 2>/dev/null; then
    npm uninstall -g @openai/codex
else
    sudo npm uninstall -g @openai/codex
fi

echo "Codex CLI uninstalled."
