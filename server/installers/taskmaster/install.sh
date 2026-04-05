#!/bin/bash

# ============================================================================
# TaskMaster AI installer — on-demand installation from Settings UI
# ============================================================================
# Installs task-master-ai via npm global package. Idempotent: skips if
# already installed. Per-project initialization is handled separately
# via the TaskMaster Setup modal.

set -euo pipefail

# Check known global install locations only — not command -v, which could
# find binaries from node_modules/.bin/ when run under npm.
for bin in /usr/local/bin/task-master /usr/bin/task-master; do
    if [ -x "$bin" ]; then
        echo "TaskMaster AI already installed."
        "$bin" --version 2>/dev/null || true
        exit 0
    fi
done

echo "Installing TaskMaster AI..."
if [ -w "$(npm root -g)" ] 2>/dev/null; then
    npm install -g task-master-ai
else
    sudo npm install -g task-master-ai
fi

# Verify installation
for bin in /usr/local/bin/task-master /usr/bin/task-master; do
    if [ -x "$bin" ]; then
        echo "TaskMaster AI installed successfully."
        "$bin" --version 2>/dev/null || true
        exit 0
    fi
done

echo "ERROR: TaskMaster installation failed — binary not found."
exit 1
