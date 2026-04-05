#!/bin/bash

# ============================================================================
# Claude Code uninstaller
# ============================================================================

set -euo pipefail

USER_HOME="${HOME}"

echo "Uninstalling Claude Code..."

# Remove binary and symlink.
rm -f "$USER_HOME/.local/bin/claude"
sudo rm -f /usr/local/bin/claude 2>/dev/null || true

echo "Claude Code uninstalled."
