# =============================================================================
# CloudCLI UI — Development Image
# =============================================================================
# Multi-stage build that produces a lightweight image with the CloudCLI web UI.
# AI clients are NOT pre-installed — they are installed on-demand from the
# Settings screen, keeping the image small and giving users control over which
# clients to install.
#
# Supported clients (installed via Settings > Agents > Account):
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
    && npm cache clean --force \
    && rm -rf .git .husky .github dev src docs scripts \
              index.html release.sh \
              eslint.config.js commitlint.config.js \
              postcss.config.js tailwind.config.js tsconfig.json

# ── Stage 2: Runtime (AI clients installed on-demand via Settings UI) ───────
FROM ubuntu:24.04

LABEL maintainer="CloudCLI Contributors"
LABEL description="CloudCLI UI — AI clients installed on-demand from Settings"

ENV DEBIAN_FRONTEND=noninteractive

# Prevent apt from trying to start services (no systemd in containers),
# install core workspace packages + Node.js 22 (required by the app).
# AI-client-specific deps (jq, python3, bubblewrap) are installed on-demand
# by each client's installer script — not baked into the base image.
# bash is already included in ubuntu:24.04.
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d \
    && chmod +x /usr/sbin/policy-rc.d \
    && apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        sudo \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for running the app and user-space CLI installs.
ARG USERNAME=dev
RUN useradd -m -s /bin/bash ${USERNAME} \
    && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Copy built app from Stage 1 and runtime entrypoint (kept outside /opt/cloudcli
# so a dev-mode volume mount over the app directory does not mask it).
COPY --from=builder /app /opt/cloudcli
COPY dev/entrypoint.sh /usr/local/bin/cloudcli-entrypoint.sh

# Make scripts executable and hand ownership to the app user.
RUN chmod +x /opt/cloudcli/server/installers/*/*.sh 2>/dev/null || true \
    && chmod +x /usr/local/bin/cloudcli-entrypoint.sh \
    && chown -R ${USERNAME}:${USERNAME} /opt/cloudcli

USER ${USERNAME}
WORKDIR /opt/cloudcli

ENV PATH="/home/${USERNAME}/.local/bin:/usr/local/bin:${PATH}"

EXPOSE 5173 8080

ENTRYPOINT ["cloudcli-entrypoint.sh"]
CMD ["node", "server/index.js"]
