#!/bin/bash
set -eo pipefail

# =============================================================================
# Stop the CloudCLI development container
# =============================================================================
# Usage: ./dev/stop.sh [--clean|-c]
#
# Options:
#   --clean, -c   Also remove all persistent Docker volumes (node_modules,
#                 home, usr, var). This resets the container to a fresh state —
#                 any AI clients installed at runtime will need to be reinstalled.

CONTAINER_NAME="ai-workstation-dev"
VOLUMES="ai-workstation-node-modules ai-workstation-home ai-workstation-usr ai-workstation-var"

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
    for vol in $VOLUMES; do
        if docker volume ls -q | grep -q "^${vol}$"; then
            echo "Removing volume $vol ..."
            docker volume rm "$vol"
            echo "Volume $vol removed."
        fi
    done
fi
