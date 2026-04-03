#!/bin/bash
set -e

# =============================================================================
# CloudCLI UI — Container Entrypoint
# =============================================================================
# Runs as root after volume seeding (init.sh). Re-applies apt service-start
# guards (since /usr is a named volume), handles runtime API-key auth, then
# drops to the app user for the main process.
#
# AI clients are NOT pre-installed. They are installed on-demand through the
# Settings > Agents screen. This entrypoint only performs auth setup for
# clients that happen to already be installed.
#
# Environment variables (all optional — pass via docker run -e):
#   ANTHROPIC_API_KEY  — picked up automatically by Claude Code
#   GEMINI_API_KEY     — picked up automatically by Gemini CLI
#   OPENAI_API_KEY     — used below to authenticate Codex CLI
#   CURSOR_API_KEY     — picked up automatically by Cursor CLI
#   SERVER_PORT        — CloudCLI server port (default: 8080)

# ── Re-apply apt-get service-start guards ──────────────────────────────────
# /usr is a named volume — these files must be rewritten on every start to
# prevent apt-get from hanging if packages are installed at runtime.
printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
chmod +x /usr/sbin/policy-rc.d
printf '#!/bin/sh\nexit 0\n' > /usr/bin/systemctl
chmod +x /usr/bin/systemctl

# ── Persist and restore API keys ───────────────────────────────────────────
# When API keys are passed via docker run -e, save them to the persistent
# /home volume so they survive container restarts even when the -e flags are
# not provided again. On subsequent starts without -e, restore from the saved
# files. Docker env vars always take precedence over saved values.
KEY_DIR="/home/dev"

_persist_key() {
    local env_name="$1" key_file="$2"
    local val="${!env_name}"
    if [ -n "$val" ]; then
        printf '%s' "$val" > "$key_file"
        chmod 600 "$key_file"
        chown dev:dev "$key_file"
    elif [ -f "$key_file" ]; then
        export "$env_name=$(cat "$key_file")"
    fi
}

_persist_key ANTHROPIC_API_KEY "$KEY_DIR/.anthropic_api_key"
_persist_key GEMINI_API_KEY    "$KEY_DIR/.gemini_api_key"
_persist_key OPENAI_API_KEY    "$KEY_DIR/.openai_api_key"
_persist_key CURSOR_API_KEY    "$KEY_DIR/.cursor_api_key"

# ── Authenticate Codex CLI if API key is available and Codex is installed ──
# Codex requires an explicit login step; the other three clients read their
# respective API key env vars at invocation time.
if [ -n "${OPENAI_API_KEY:-}" ] && command -v codex &>/dev/null; then
    echo "Authenticating Codex CLI..."
    printenv OPENAI_API_KEY | codex login --with-api-key 2>/dev/null || true
fi

# ── Execute CMD as the app user ────────────────────────────────────────────
# The container starts as root for volume seeding. Drop to the non-root app
# user for the main process. runuser preserves the current environment
# (API keys, PATH) without creating a login session.
export HOME="/home/dev"
exec runuser -u dev -- "$@"
