#!/bin/bash
set -eo pipefail

# =============================================================================
# Stop the CloudCLI development container
# =============================================================================
# Usage: ./dev/stop.sh [--clean|-c]
#
# Options:
#   --clean, -c   Also remove the node_modules Docker volume

CONTAINER_NAME="cloudcli-dev"
VOLUME_NAME="cloudcli-node-modules"

CLEAN=false
for arg in "$@"; do
    case "$arg" in
        --clean|-c) CLEAN=true ;;
    esac
done

if docker ps -q -f name="^${CONTAINER_NAME}$" | grep -q .; then
    echo "Stopping $CONTAINER_NAME ..."
    docker stop "$CONTAINER_NAME"
    docker rm "$CONTAINER_NAME"
    echo "Stopped."
elif docker ps -aq -f name="^${CONTAINER_NAME}$" | grep -q .; then
    echo "Removing stopped container $CONTAINER_NAME ..."
    docker rm "$CONTAINER_NAME"
    echo "Removed."
else
    echo "Container $CONTAINER_NAME is not running."
fi

if [ "$CLEAN" = true ]; then
    if docker volume ls -q | grep -q "^${VOLUME_NAME}$"; then
        echo "Removing volume $VOLUME_NAME ..."
        docker volume rm "$VOLUME_NAME"
        echo "Volume removed."
    else
        echo "Volume $VOLUME_NAME does not exist."
    fi
fi
