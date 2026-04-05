# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Web UI for AI coding agents (Claude Code, Cursor CLI, Codex, Gemini CLI). React + Express + SQLite. Published to npm as `@cloudcli-ai/cloudcli`.

## Commands

```bash
npm run dev          # Start frontend (Vite :5173) + backend (Express :3001) concurrently
npm run client       # Vite dev server only
npm run server       # Express backend only
npm run build        # Production build (Vite → dist/)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint on src/
npm run lint:fix     # ESLint autofix
npm run release      # release-it (bumps version, changelog, npm publish, GitHub release)
```

Requires Node.js 22+. Husky pre-commit hook runs lint-staged (ESLint on `src/**/*.{ts,tsx,js,jsx}`). Commits must follow Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.) enforced by commitlint.

## Architecture

**Frontend** (React 18 + TypeScript + Vite + Tailwind CSS):
- `src/components/` — Feature-organized: `chat/`, `shell/`, `file-tree/`, `git-panel/`, `settings/`, `auth/`, `code-editor/`, `sidebar/`, `task-master/`, `plugins/`
- `src/contexts/` — React contexts: Auth, WebSocket, Theme, Plugins, TaskMaster, TasksSettings
- `src/stores/` — Zustand-style stores (`useSessionStore`)
- `src/hooks/` — Custom hooks for device settings, projects, version checks, web push, session protection
- `src/i18n/` — Internationalization (i18next)

**Backend** (Express, plain JS with ESM):
- `server/index.js` — Main entry; Express app, WebSocket server, PTY shell spawning, file watchers for provider session directories
- `server/providers/` — Provider adapter pattern via `registry.js`: claude, cursor, codex, gemini. Each has an `adapter.js` implementing a common interface (`types.js`)
- `server/routes/` — REST API routes: agent, auth, git, mcp, commands, settings, projects, plugins, messages, cli-installer, taskmaster, codex, cursor, gemini
- `server/installers/` — Shell scripts (`install.sh`/`uninstall.sh`) for each AI client (claude, codex, cursor, gemini, taskmaster)
- `server/database/` — SQLite via better-sqlite3 (`db.js`, `init.sql`)
- `server/claude-sdk.js` — Claude Agent SDK integration (`@anthropic-ai/claude-agent-sdk`)

**Shared** (`shared/`):
- `networkHosts.js` — Host/loopback normalization utilities (used by both Vite config and server)

**Environment**: Configured via `.env` (see `.env.example`). Key vars: `SERVER_PORT` (default 3001), `VITE_PORT` (default 5173), `HOST`, `BASE_PATH`, `VITE_IS_PLATFORM`, `DATABASE_PATH`, `WORKSPACES_ROOT`.

## Provider Adapter System

All providers (claude, cursor, codex, gemini) implement the same interface defined in `server/providers/types.js`:

- `fetchHistory(sessionId, opts)` — Reads persisted messages from disk/database, returns `{messages, total, hasMore}`
- `normalizeMessage(raw, sessionId)` — Converts provider-specific events into `NormalizedMessage[]`

Always use `server/providers/registry.js` (`getProvider(name)`) to get adapters — never import them directly.

**NormalizedMessage kinds**: `text`, `tool_use`, `tool_result`, `thinking`, `stream_delta`, `stream_end`, `error`, `complete`, `status`, `permission_request`, `permission_cancelled`, `session_created`, `interactive_prompt`, `task_notification`.

**Provider-specific storage locations**:
- Claude: `~/.claude/projects/{projectName}/*.jsonl`
- Cursor: `~/.cursor/chats/{MD5(projectPath)}/{sessionId}/store.db` (SQLite, DAG-based message parsing)
- Codex: `~/.codex/sessions/*.jsonl` (two formats: history entries vs SDK events)
- Gemini: in-memory sessionManager first, falls back to `~/.gemini/sessions/*.jsonl`

**Tool result attachment**: Tool results arrive as parts within user messages. Adapters extract them in a two-pass algorithm and attach them to corresponding `tool_use` messages via `toolId` matching.

Each provider also has: route handlers in `server/routes/`, installer scripts in `server/installers/<name>/`, and frontend tool config overrides in `src/components/chat/tools/configs/<name>/`.

The unified messages endpoint is `GET /api/sessions/:sessionId/messages?provider=<name>&projectName=<name>&limit=50&offset=0`.

## Chat Tool Rendering

Config-driven system in `src/components/chat/tools/` — all tool display behavior defined in `configs/toolConfigs.ts`. Two base patterns: `OneLineDisplay` (compact) and `CollapsibleDisplay` (expandable with children). To add a new tool, add a config entry and optionally a category color in `ToolRenderer.tsx`. See `tools/README.md` for the full reference.

## WebSocket Dual-Path Architecture

Two WebSocket paths, both authenticated via JWT token query param:

- **`/ws`** — Chat/messages stream. Accepts `claude-command` type messages (user input). Streams provider responses as `{type: 'message', ...normalized}`. Handles session switching, interrupt, and tool approval.
- **`/shell`** — PTY terminal I/O. Message types: `init` (spawn PTY), `input` (keystrokes), `resize`. Includes URL detection in terminal output with auto-open logic. PTY sessions timeout after 30 mins on disconnect.

**File watchers** (chokidar) monitor provider directories (`~/.claude/projects`, `~/.cursor/chats`, etc.) and broadcast `{type: 'projects_updated'}` to all clients on changes (300ms debounce).

## Frontend Session Store

`src/stores/useSessionStore.ts` — In-memory Map keyed by sessionId. Each slot holds:
- `serverMessages` — fetched from backend via `/api/sessions/:id/messages`
- `realtimeMessages` — received via WebSocket during active streaming
- `merged` — deduplicated union (server entries win on ID collision)

The backend JSONL/DB files are the source of truth, not the store.

## Context Provider Nesting Order

Defined in `src/App.tsx` — order matters for dependency resolution:

```
I18nextProvider → ThemeProvider → AuthProvider → WebSocketProvider
  → PluginsProvider → TasksSettingsProvider → TaskMasterProvider
    → ProtectedRoute → Router
```

Auth must initialize before WebSocket (provides token). WebSocket must initialize before TaskMaster (carries taskmaster-* messages).

## Authentication

**Setup mode**: First visit triggers user registration (`POST /api/auth/register`, one-time only). Subsequent logins via `POST /api/auth/login`.

**JWT**: 7-day expiry, auto-generated secret stored in `app_config` table. Token auto-refresh: if past halfway through lifetime, response includes `X-Refreshed-Token` header.

**Platform mode** (`VITE_IS_PLATFORM=true`): Auto-logs in first database user, skips token validation. Used for embedded/hosted deployments.

## Database

SQLite via better-sqlite3 at `~/.ai-workstation/auth.db` (or `DATABASE_PATH` env var). Key tables:
- `users` — single-user system (username, password_hash, onboarding status)
- `app_config` — JWT secret storage
- `session_names` — custom display names for provider sessions
- `api_keys`, `user_credentials` — API key storage and OAuth tokens

## CLI Installer System

`server/routes/cli-installer.js` uses a `CLIENT_REGISTRY` mapping each provider to:
- `detectPaths` — filesystem locations to check for the binary
- `versionArgs` — args to get version string
- `installScript` / `uninstallScript` — paths under `server/installers/{provider}/`
- `timeout` — max install duration (120s default)

`KEY_CONFIG` maps providers to their API key env vars, key file paths, and validation endpoints.

## Plugin System

Plugins live in a plugins directory, each with a `plugin.json` manifest. Lifecycle:
1. **Discovery**: `GET /api/plugins` scans directory, returns manifests + server status
2. **Server management**: `server/utils/plugin-process-manager.js` spawns/kills plugin server processes, manages port allocation
3. **Asset serving**: `GET /api/plugins/:name/assets/*` with no-cache headers
4. **Install**: `POST /api/plugins/install` git-clones from URL, auto-starts server
5. **Toggle/Update/Uninstall**: enable/disable, git pull + restart, stop + delete

## Vite Dev Proxy

`vite.config.js` proxies three paths to the Express backend:
- `{BASE_PATH}/api` → `http://localhost:{SERVER_PORT}`
- `{BASE_PATH}/ws` → `ws://localhost:{SERVER_PORT}` (WebSocket upgrade)
- `{BASE_PATH}/shell` → `ws://localhost:{SERVER_PORT}` (WebSocket upgrade)

`BASE_PATH` env var supports deployment under a subpath. Host binding uses `shared/networkHosts.js` to normalize wildcard (0.0.0.0) to localhost for browser connections.

Production build splits vendor chunks (react, codemirror, xterm) and outputs to `dist/`.

## Routing

Two frontend routes in `src/App.tsx`:
- `/` — Home/session list
- `/session/:sessionId` — Active session view

Both render `AppContent`; the `sessionId` URL param drives which session is active in the store.

## ESLint Configuration

Flat config (`eslint.config.js`). Only lints `src/` (frontend). Key rules:
- `unused-imports/no-unused-imports`: warn (unused vars with `_` prefix ignored)
- `@typescript-eslint/no-explicit-any`: off
- `import-x/order`: enforced (no newlines between groups)
- `tailwindcss/classnames-order`: warn
- React hooks rules: enforced
