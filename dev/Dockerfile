# =============================================================================
# CloudCLI UI — Development Image
# =============================================================================
# Multi-stage build that produces a self-contained image with the CloudCLI web
# UI and all four AI clients pre-installed at build time:
#
#   - Claude Code     (official installer)
#   - Gemini CLI      (npm global)
#   - OpenAI Codex    (npm global)
#   - Cursor CLI      (official installer)
#
# Build (from repo root):
#   docker build -f dev/Dockerfile -t cloudcli-dev .
#
# Run:
#   docker run -it --rm \
#     -e ANTHROPIC_API_KEY=sk-... \
#     -e GEMINI_API_KEY=... \
#     -e OPENAI_API_KEY=sk-... \
#     -e CURSOR_API_KEY=... \
#     -p 8080:8080 \
#     cloudcli-dev
#
# Tip: add a .dockerignore at the repo root with "node_modules" and ".git"
#      to speed up builds by keeping the build context small.

# ── Stage 1: Build CloudCLI web UI ──────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        git make g++ python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/ scripts/
RUN npm ci
COPY . .
RUN printf 'SERVER_PORT=8080\nHOST=0.0.0.0\n' > .env \
    && npm run build \
    && npm prune --production \
    && rm -rf .git .husky .github dev

# ── Stage 2: Runtime with pre-installed AI clients ──────────────────────────
FROM ubuntu:24.04

LABEL maintainer="CloudCLI Contributors"
LABEL description="CloudCLI UI with pre-installed AI clients (Claude, Gemini, Codex, Cursor)"

ENV DEBIAN_FRONTEND=noninteractive

# Prevent apt from trying to start services (no systemd in containers).
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d \
    && chmod +x /usr/sbin/policy-rc.d

# System packages + Node.js 22 (required by the app, Gemini CLI, and Codex).
# bubblewrap is the sandbox dependency for Codex.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        sudo \
        bash \
        ca-certificates \
        jq \
        git \
        python3 \
        bubblewrap \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for running the app and user-space CLI installs.
ARG USERNAME=dev
RUN useradd -m -s /bin/bash ${USERNAME} \
    && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Copy built app from Stage 1.
COPY --from=builder /app /opt/cloudcli

# Install all four AI clients at build time.
COPY dev/install-clients.sh /tmp/install-clients.sh
RUN chmod +x /tmp/install-clients.sh \
    && USERNAME=${USERNAME} /tmp/install-clients.sh \
    && rm /tmp/install-clients.sh

# Copy runtime entrypoint outside /opt/cloudcli so a dev-mode volume mount
# over the app directory does not mask it.
COPY dev/entrypoint.sh /usr/local/bin/cloudcli-entrypoint.sh
RUN chmod +x /usr/local/bin/cloudcli-entrypoint.sh

# Hand ownership to the app user.
RUN chown -R ${USERNAME}:${USERNAME} /opt/cloudcli

USER ${USERNAME}
WORKDIR /opt/cloudcli

ENV PATH="/home/${USERNAME}/.local/bin:/usr/local/bin:${PATH}"

EXPOSE 5173 8080

ENTRYPOINT ["cloudcli-entrypoint.sh"]
CMD ["node", "server/index.js"]
