#!/bin/bash

# ============================================================================
# Gemini CLI uninstaller
# ============================================================================

set -euo pipefail

echo "Uninstalling Gemini CLI..."

if [ -w "$(npm root -g)" ] 2>/dev/null; then
    npm uninstall -g @google/gemini-cli
else
    sudo npm uninstall -g @google/gemini-cli
fi

echo "Gemini CLI uninstalled."
