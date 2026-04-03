#!/bin/bash
set -euo pipefail

# =============================================================================
# AI Client Installer — build-time installation of all four AI clients
# =============================================================================
# Based on magneto/apps/ai-studio/image/installer/cli/ scripts, adapted for
# pre-bundling into the image (rather than deferred runtime installation).
#
# Runs as root during `docker build`. Expects USERNAME env var (default: dev).
#
# Installs:
#   1. Claude Code    — official installer -> ~/.local/bin/claude
#   2. Gemini CLI     — npm global package
#   3. OpenAI Codex   — npm global package
#   4. Cursor CLI     — official installer -> ~/.local/bin/agent

USERNAME="${USERNAME:-dev}"
USER_HOME=$(eval echo "~$USERNAME")

echo "================================================================"
echo " Installing AI clients for user: $USERNAME"
echo "================================================================"

# ── 1. Claude Code ──────────────────────────────────────────────────────────
echo ""
echo "[1/4] Installing Claude Code..."

su - "$USERNAME" -c 'export PATH="$HOME/.local/bin:$PATH" && curl -fsSL https://claude.ai/install.sh | bash'

if [ ! -x "$USER_HOME/.local/bin/claude" ]; then
    echo "  ERROR: Claude Code binary not found at $USER_HOME/.local/bin/claude"
    exit 1
fi

# Symlink so claude is on PATH for all shell types (non-login, non-interactive).
ln -sf "$USER_HOME/.local/bin/claude" /usr/local/bin/claude

# Skip the first-run onboarding wizard.
su - "$USERNAME" -c \
    'echo "{}" | jq ".hasCompletedOnboarding = true | .oauthAccount = null" \
     > "$HOME/.claude.json" && chmod 600 "$HOME/.claude.json"'

echo "  Claude Code installed -> $(su - "$USERNAME" -c 'claude --version' 2>/dev/null || echo 'OK')"

# ── 2. Gemini CLI ───────────────────────────────────────────────────────────
echo ""
echo "[2/4] Installing Gemini CLI..."

npm install -g @google/gemini-cli

# Pre-create Gemini data directory to avoid ENOENT on first run.
mkdir -p "$USER_HOME/.gemini"
chown -R "$USERNAME:$USERNAME" "$USER_HOME/.gemini"

echo "  Gemini CLI installed -> $(gemini --version 2>/dev/null || echo 'OK')"

# ── 3. OpenAI Codex CLI ────────────────────────────────────────────────────
echo ""
echo "[3/4] Installing OpenAI Codex CLI..."

npm install -g @openai/codex

echo "  Codex CLI installed -> $(codex --version 2>/dev/null || echo 'OK')"

# ── 4. Cursor CLI ───────────────────────────────────────────────────────────
echo ""
echo "[4/4] Installing Cursor CLI..."

su - "$USERNAME" -c 'export PATH="$HOME/.local/bin:$PATH" && curl -fsS https://cursor.com/install | bash'

if [ ! -x "$USER_HOME/.local/bin/agent" ]; then
    echo "  ERROR: Cursor CLI binary not found at $USER_HOME/.local/bin/agent"
    exit 1
fi

# Symlink so agent is on PATH for all shell types.
ln -sf "$USER_HOME/.local/bin/agent" /usr/local/bin/agent

# Pre-create Cursor data directories to prevent EACCES on first run.
mkdir -p "$USER_HOME/.cursor/projects"
chown -R "$USERNAME:$USERNAME" "$USER_HOME/.cursor"

echo "  Cursor CLI installed -> $(su - "$USERNAME" -c 'agent --version' 2>/dev/null || echo 'OK')"

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " All AI clients installed successfully."
echo "================================================================"
