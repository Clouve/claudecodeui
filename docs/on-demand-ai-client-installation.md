# On-Demand AI Client Installation

## Overview

AI clients (Claude Code, Gemini CLI, OpenAI Codex, Cursor CLI) are **not pre-bundled** in the Docker image. They are installed on-demand from the **Settings > Agents > Account** screen, giving users control over which clients to install and always pulling the latest versions.

This approach mirrors the reference implementation at `magneto/apps/ai-studio/image/installer/`.

## Architecture

```
Browser (Settings UI)
  │
  ├─ GET  /api/cli-installer/status              → detect all 4 clients
  ├─ GET  /api/cli-installer/:provider/status     → detect one client
  ├─ GET  /api/cli-installer/key-status           → env-var API key detection for all providers
  ├─ POST /api/cli-installer/:provider/validate-key → validate API key against provider API
  ├─ POST /api/cli-installer/:provider/save-key     → persist validated key as env var
  ├─ POST /api/cli-installer/:provider/install      → run install script, stream logs via WS
  └─ POST /api/cli-installer/:provider/uninstall    → run uninstall script, stream logs via WS
  │
  ▼
server/routes/cli-installer.js
  │
  ├── WebSocket broadcast (install_log events) ──→ Browser (real-time log)
  │
  ▼
server/installers/{claude,gemini,codex,cursor}/{install,uninstall}.sh
```

## Key Files

### Server

| File | Purpose |
|------|---------|
| `server/routes/cli-installer.js` | API route — status detection, key validation, install/uninstall orchestration, post-install auth, WebSocket log streaming |
| `server/routes/cli-auth.js` | Per-provider auth status checks (env vars, credential files, OAuth tokens) |
| `server/installers/claude/install.sh` | Claude Code installer (curl from claude.ai) |
| `server/installers/claude/uninstall.sh` | Claude Code uninstaller |
| `server/installers/gemini/install.sh` | Gemini CLI installer (npm global) |
| `server/installers/gemini/uninstall.sh` | Gemini CLI uninstaller |
| `server/installers/codex/install.sh` | Codex CLI installer (npm global) |
| `server/installers/codex/uninstall.sh` | Codex CLI uninstaller |
| `server/installers/cursor/install.sh` | Cursor CLI installer (curl from cursor.com) |
| `server/installers/cursor/uninstall.sh` | Cursor CLI uninstaller |

### Frontend

| File | Purpose |
|------|---------|
| `src/components/settings/hooks/useSettingsController.ts` | `installClient()` / `uninstallClient()` / `checkInstallStatus()` / `validateApiKey()` / `resetApiKeyValidation()` / `fetchKeyStatus()` + WebSocket log listener |
| `src/components/settings/view/tabs/agents-settings/sections/content/AccountContent.tsx` | API key input & validation, install/uninstall UI with status badges, real-time log display |
| `src/components/settings/view/tabs/agents-settings/sections/AgentSelectorSection.tsx` | Agent tab selector (display order: Claude, Gemini, Codex, Cursor) |
| `src/components/settings/view/tabs/agents-settings/types.ts` | `AgentContext` type with `apiKeyStatus`, `onValidateApiKey`, `onResetApiKeyValidation` |
| `src/components/settings/types/types.ts` | `InstallStatus`, `ApiKeyStatus`, `ApiKeyValidationStatus` types |
| `src/components/settings/constants/constants.ts` | `DEFAULT_INSTALL_STATUS`, `DEFAULT_API_KEY_STATUS`, `AGENT_PROVIDERS` |
| `src/i18n/locales/en/settings.json` | `agents.install.*`, `agents.apiKey.*` i18n strings |

### Docker

| File | Purpose |
|------|---------|
| `dev/Dockerfile` | Installer scripts ship with the app via `server/installers/` |
| `dev/entrypoint.sh` | Gracefully handles missing clients |

## Detection Strategy

Clients are detected by checking **explicit binary paths only** — not `command -v` or generic PATH lookups. This prevents false positives from `node_modules/.bin/` binaries when the server runs under `npm run dev`.

```javascript
// server/routes/cli-installer.js
const CLIENT_REGISTRY = {
  claude: {
    detectPaths: () => [
      path.join(os.homedir(), '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
    ],
    // ...
  },
  codex: {
    detectPaths: () => [
      '/usr/local/bin/codex',
      '/usr/bin/codex',
    ],
    // ...
  },
  // similarly for cursor, gemini
};
```

The install scripts use the same approach — checking specific paths instead of `command -v` to avoid detecting project SDK binaries as installed CLI tools.

## API Contract

### `GET /api/cli-installer/status`

```json
{
  "success": true,
  "clients": {
    "claude":  { "installed": false },
    "gemini":  { "installed": true, "version": "0.36.0" },
    "codex":   { "installed": true, "version": "codex-cli 0.118.0", "path": "/usr/bin/codex" },
    "cursor":  { "installed": false }
  }
}
```

### `GET /api/cli-installer/key-status`

```json
{
  "success": true,
  "keys": {
    "claude":  { "available": true,  "source": "env", "masked": "••••••••sk-1", "envVar": "ANTHROPIC_API_KEY" },
    "gemini":  { "available": false, "source": null,  "masked": null,            "envVar": "GEMINI_API_KEY" },
    "codex":   { "available": false, "source": null,  "masked": null,            "envVar": "OPENAI_API_KEY" },
    "cursor":  { "available": false, "source": null,  "masked": null,            "envVar": "CURSOR_API_KEY" }
  }
}
```

### `POST /api/cli-installer/:provider/validate-key`

Request: `{ "apiKey": "sk-..." }`

```json
{ "valid": true, "error": null }
```

For Cursor, always returns `{ "valid": true }` (no REST validation endpoint).

### `POST /api/cli-installer/:provider/save-key`

Request: `{ "apiKey": "sk-..." }`

Persists the key as `process.env[KEY_VAR]` so child processes (install scripts, CLI tools) can read it at runtime.

```json
{ "success": true }
```

### `POST /api/cli-installer/:provider/install`

Runs the install script and returns JSON when complete. Each stdout/stderr line is also broadcast in real time via WebSocket as `{ type: "install_log", provider, action: "install", line }`.

```json
{
  "success": true,
  "message": "Codex CLI completed successfully.",
  "log": [
    "Installing OpenAI Codex CLI...",
    "added 2 packages in 2s",
    "Codex CLI installed successfully.",
    "codex-cli 0.101.0"
  ],
  "installed": true,
  "version": "codex-cli 0.118.0",
  "path": "/usr/bin/codex"
}
```

### `POST /api/cli-installer/:provider/uninstall`

Same shape as install, with `"installed": false` on success. Logs streamed as `action: "uninstall"`.

## API Key Validation Gate

Installation of any AI client (except Cursor) requires a validated API key. This mirrors the reference implementation at `magneto/apps/ai-studio/image/installer/`.

### Flow

1. **Settings open** — `GET /key-status` checks if env vars are already set for each provider.
2. **Env-var key detected** — Input field shows masked placeholder, is disabled, key treated as pre-validated. Install button is immediately available.
3. **User enters key** — Input field accepts the key. Typing resets any prior validation state, disabling the Install button until revalidation.
4. **User clicks Validate** — `POST /:provider/validate-key` validates against the provider's API (HTTP GET to models endpoint). On success, `POST /:provider/save-key` persists the key as `process.env[KEY_VAR]`.
5. **Install enabled** — Install button becomes clickable. The install script inherits the env var.
6. **Post-install auth** — Provider-specific authentication runs automatically (e.g. `codex login --with-api-key`, Cursor agent verification).
7. **Connection Status** — Health check confirms end-to-end connectivity using the persisted key.

### Cursor Exception

Cursor has no REST API validation endpoint. The user enters a key and clicks **Save** (not Validate) to persist it as an env var. The Install button is always available. After installation, the backend runs `agent -p -f --trust` with `CURSOR_API_KEY` set, then verifies via `agent status` — matching the approach in `magneto/apps/ai-studio/image/installer/cli/cursor/install.sh`.

### Post-Install Authentication

Some CLIs require an explicit login step after installation to register the API key:

| Provider | Post-install action |
|----------|-------------------|
| Claude | None — reads `ANTHROPIC_API_KEY` from environment |
| Gemini | None — reads `GEMINI_API_KEY` from environment |
| Codex | `codex login --with-api-key` (key piped via stdin) |
| Cursor | `agent -p -f --trust '...'` + `agent status` verification |

### Validation Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cli-installer/key-status` | GET | Detect env-var API keys for all providers |
| `/api/cli-installer/:provider/validate-key` | POST | Validate `{ apiKey }` against provider API |
| `/api/cli-installer/:provider/save-key` | POST | Persist `{ apiKey }` as `process.env` |

### Provider Validation URLs

| Provider | Validation URL | Auth Method |
|----------|---------------|-------------|
| Claude | `https://api.anthropic.com/v1/models` | `x-api-key` header |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models` | `key` query param |
| Codex | `https://api.openai.com/v1/models` | `Authorization: Bearer` header |
| Cursor | None | Save-first, validate post-install |

## Real-Time Log Streaming

Install and uninstall operations stream log output to the browser in real time via WebSocket, so users see activity as it happens rather than waiting for the process to complete.

### How it works

1. The `runScript()` function in `cli-installer.js` accepts an optional `{ wss, provider, action }` context.
2. Each stdout/stderr line from the install script is broadcast as a WebSocket message: `{ type: "install_log", provider, action, line }`.
3. The frontend `useSettingsController` hook listens for `install_log` messages via `useWebSocket()` and appends each line to the matching provider's `installStatus.log` array.
4. The log section in `AccountContent` auto-expands during install/uninstall and renders new lines as they arrive.
5. The final JSON response still includes the complete `log` array for consistency.

Post-install authentication steps (Codex login, Cursor verification) also stream their output through the same WebSocket channel.

## Design Decisions

1. **Plain JSON + WebSocket streaming** — The HTTP response is synchronous JSON (SSE was rejected because the Vite dev proxy buffers it). Real-time feedback is provided via WebSocket `install_log` events, which are already supported by the existing WS infrastructure.

2. **Installers live in `server/installers/`** — Part of the application, not the Docker setup. Works identically when running natively (`npm run dev`) or inside Docker.

3. **Explicit path detection** — The project has `@openai/codex-sdk` as a dependency, which ships a `codex` binary in `node_modules/.bin/`. When the server runs via `npm run dev`, npm adds `node_modules/.bin/` to PATH, causing `command -v codex` to return a false positive. Checking only `/usr/local/bin/`, `/usr/bin/`, and `~/.local/bin/` eliminates this.

4. **Process not killed on client disconnect** — If the browser navigates away during install, the script runs to completion. Only the response writing stops.

5. **Validation bound to exact key value** — Modifying the API key input after validation immediately resets the validation state. The Install button is disabled until the new key is explicitly revalidated. This prevents installing with a stale or incorrect key.

6. **Key persisted before install** — Validated keys are written to `process.env` before the install script runs, so the script and any post-install auth steps can read the key at runtime. The Connection Status section serves as the post-install health check.

7. **No login prompt in Connection Status** — Since the API key is defined and persisted prior to installation, there is no separate login step. Connection Status solely reports whether the installed client can authenticate using the persisted key.

## Related Fixes

- **`VITE_IS_PLATFORM` blank page** — Platform mode requires a user in the database for `authenticateToken` middleware. `server/index.js` now auto-creates a `platform` user with completed onboarding on first start when `IS_PLATFORM=true`.

- **`server/routes/mcp.js` crash** — All 5 `claude` CLI spawn handlers had both `close` and `error` listeners sending responses. When the binary was missing (ENOENT), both fired, causing `ERR_HTTP_HEADERS_SENT` which crashed Node. Fixed with `responded` guards on each handler pair.
