#!/bin/bash
set -eo pipefail

# =============================================================================
# Build the CloudCLI development Docker image
# =============================================================================
# Usage:  ./dev/build.sh [docker build flags...]
# Example: ./dev/build.sh --no-cache

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="cloudcli-dev"

cd "$REPO_ROOT"

echo "Building $IMAGE_NAME from $REPO_ROOT ..."
docker build -f dev/Dockerfile -t "$IMAGE_NAME" "$@" .
echo ""
echo "Done. Run ./dev/start.sh to launch the container."
