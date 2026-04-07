#!/bin/bash
set -eo pipefail

# =============================================================================
# Start the AI Workstation development container
# =============================================================================
# Usage:  ./dev/start.sh [dev|prod] [docker run flags...]
#
# Modes:
#   dev  (default)  — mounts source code for live editing + HMR via Vite
#   prod            — runs the pre-built image as-is
#
# API keys are forwarded from the host environment when set:
#   ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, CURSOR_API_KEY
#
# Override the host port:  PORT=3000 ./dev/start.sh dev

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

CONTAINER_NAME="ai-workstation-dev"
IMAGE_NAME="ai-workstation-dev"

# Named volumes for directories seeded by init.sh. These persist AI clients
# installed at runtime (via Settings > Agents) across container restarts.
VOLUME_HOME="ai-workstation-home"
VOLUME_USR="ai-workstation-usr"
VOLUME_VAR="ai-workstation-var"

# ── Parse mode argument ─────────────────────────────────────────────────────
MODE="dev"
if [ $# -gt 0 ]; then
    case "$1" in
        dev|prod) MODE="$1"; shift ;;
        -*)       ;;   # first arg is a docker flag, keep default
        *)
            echo "Usage: $0 [dev|prod] [docker run flags...]"
            echo ""
            echo "  dev   Mount source code, run Vite dev server with HMR (default)"
            echo "  prod  Run the pre-built image as-is"
            exit 1
            ;;
    esac
fi

# ── Remove any leftover container ───────────────────────────────────────────
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# ── Pass through API keys from the host environment ─────────────────────────
ENV_ARGS=""
[ -n "${ANTHROPIC_API_KEY:-}" ]  && ENV_ARGS="$ENV_ARGS -e ANTHROPIC_API_KEY"
[ -n "${GEMINI_API_KEY:-}" ]     && ENV_ARGS="$ENV_ARGS -e GEMINI_API_KEY"
[ -n "${OPENAI_API_KEY:-}" ]     && ENV_ARGS="$ENV_ARGS -e OPENAI_API_KEY"
[ -n "${CURSOR_API_KEY:-}" ]     && ENV_ARGS="$ENV_ARGS -e CURSOR_API_KEY"

# ── Launch container ─────────────────────────────────────────────────────────
# shellcheck disable=SC2086
if [ "$MODE" = "dev" ]; then
    PORT="${PORT:-8080}"
    echo "Starting $CONTAINER_NAME in DEVELOPMENT mode on http://localhost:$PORT ..."

    # Mount source code for live editing. A named volume for node_modules
    # keeps Linux-compiled native modules separate from the host OS.
    # Home/usr/var volumes are seeded on first start by init.sh and persist
    # AI clients installed at runtime across container restarts.
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT:5173" \
        -v "$REPO_ROOT:/opt/ai-workstation" \
        -v ai-workstation-node-modules:/opt/ai-workstation/node_modules \
        -v "$VOLUME_HOME:/home" \
        -v "$VOLUME_USR:/usr" \
        -v "$VOLUME_VAR:/var" \
        $ENV_ARGS \
        "$@" \
        "$IMAGE_NAME" \
        bash -c "npm install && npm run dev"
else
    PORT="${PORT:-8080}"
    echo "Starting $CONTAINER_NAME in PRODUCTION mode on http://localhost:$PORT ..."

    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT:8080" \
        -v "$VOLUME_HOME:/home" \
        -v "$VOLUME_USR:/usr" \
        -v "$VOLUME_VAR:/var" \
        $ENV_ARGS \
        "$@" \
        "$IMAGE_NAME"
fi

echo ""
echo "Mode      : $MODE"
echo "Container : $CONTAINER_NAME"
echo "URL       : http://localhost:$PORT"
echo "Logs      : docker logs -f $CONTAINER_NAME"
echo "Stop      : $SCRIPT_DIR/stop.sh"
