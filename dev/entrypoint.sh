#!/bin/bash
set -e

# =============================================================================
# CloudCLI UI — Container Entrypoint
# =============================================================================
# Handles runtime API-key authentication, then executes the CMD passed by
# Docker (defaults to "node server/index.js" for production).
#
# Environment variables (all optional — pass via docker run -e):
#   ANTHROPIC_API_KEY  — picked up automatically by Claude Code
#   GEMINI_API_KEY     — picked up automatically by Gemini CLI
#   OPENAI_API_KEY     — used below to authenticate Codex CLI
#   CURSOR_API_KEY     — picked up automatically by Cursor CLI
#   SERVER_PORT        — CloudCLI server port (default: 8080)

# ── Authenticate Codex CLI if API key is provided ───────────────────────────
# Codex requires an explicit login step; the other three clients read their
# respective API key env vars at invocation time.
if [ -n "${OPENAI_API_KEY:-}" ] && command -v codex &>/dev/null; then
    echo "Authenticating Codex CLI..."
    printenv OPENAI_API_KEY | codex login --with-api-key 2>/dev/null || true
fi

# ── Execute CMD ─────────────────────────────────────────────────────────────
exec "$@"
