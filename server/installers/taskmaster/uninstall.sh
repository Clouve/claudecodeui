#!/bin/bash

# ============================================================================
# TaskMaster AI uninstaller
# ============================================================================

set -euo pipefail

echo "Uninstalling TaskMaster AI..."

if [ -w "$(npm root -g)" ] 2>/dev/null; then
    npm uninstall -g task-master-ai
else
    sudo npm uninstall -g task-master-ai
fi

echo "TaskMaster AI uninstalled."
