#!/bin/bash

# ============================================================================
# Cursor CLI uninstaller
# ============================================================================

set -euo pipefail

USER_HOME="${HOME}"

echo "Uninstalling Cursor CLI..."

# Remove binary and symlink.
rm -f "$USER_HOME/.local/bin/agent"
sudo rm -f /usr/local/bin/agent 2>/dev/null || true

echo "Cursor CLI uninstalled."
