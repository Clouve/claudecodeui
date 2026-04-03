# On-Demand AI Client Installation

## Overview

AI clients (Claude Code, Gemini CLI, OpenAI Codex, Cursor CLI) are **not pre-bundled** in the Docker image. They are installed on-demand from the **Settings > Agents > Account** screen, giving users control over which clients to install and always pulling the latest versions.

This approach mirrors the reference implementation at `magneto/apps/ai-studio/image/installer/`.

## Architecture

```
Browser (Settings UI)
  │
  ├─ GET  /api/cli-installer/status          → detect all 4 clients
  ├─ GET  /api/cli-installer/:provider/status → detect one client
  ├─ POST /api/cli-installer/:provider/install   → run install script, return JSON
  └─ POST /api/cli-installer/:provider/uninstall → run uninstall script, return JSON
  │
  ▼
server/routes/cli-installer.js
  │
  ▼
server/installers/{claude,cursor,gemini,codex}/{install,uninstall}.sh
```

## Key Files

### Server

| File | Purpose |
|------|---------|
| `server/routes/cli-installer.js` | API route — status detection, install/uninstall orchestration |
| `server/installers/claude/install.sh` | Claude Code installer (curl from claude.ai) |
| `server/installers/claude/uninstall.sh` | Claude Code uninstaller |
| `server/installers/cursor/install.sh` | Cursor CLI installer (curl from cursor.com) |
| `server/installers/cursor/uninstall.sh` | Cursor CLI uninstaller |
| `server/installers/gemini/install.sh` | Gemini CLI installer (npm global) |
| `server/installers/gemini/uninstall.sh` | Gemini CLI uninstaller |
| `server/installers/codex/install.sh` | Codex CLI installer (npm global) |
| `server/installers/codex/uninstall.sh` | Codex CLI uninstaller |

### Frontend

| File | Purpose |
|------|---------|
| `src/components/settings/hooks/useSettingsController.ts` | `installClient()` / `uninstallClient()` / `checkInstallStatus()` |
| `src/components/settings/view/tabs/agents-settings/sections/content/AccountContent.tsx` | Install/uninstall UI with status badge, buttons, collapsible log |
| `src/components/settings/types/types.ts` | `InstallStatus` type |
| `src/components/settings/constants/constants.ts` | `DEFAULT_INSTALL_STATUS` |
| `src/i18n/locales/en/settings.json` | `agents.install.*` i18n strings |

### Docker

| File | Purpose |
|------|---------|
| `dev/Dockerfile` | No longer runs `install-clients.sh`; installer scripts ship with the app via `server/installers/` |
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
    "cursor":  { "installed": false },
    "gemini":  { "installed": true, "version": "0.36.0" },
    "codex":   { "installed": true, "version": "codex-cli 0.118.0", "path": "/usr/bin/codex" }
  }
}
```

### `POST /api/cli-installer/:provider/install`

Runs the install script synchronously and returns JSON when complete:

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

Same shape as install, with `"installed": false` on success.

## Design Decisions

1. **Plain JSON, not SSE** — The Vite dev proxy buffers SSE responses, which caused the frontend to never receive completion events. Switching to a synchronous JSON response works reliably through any proxy. The frontend shows an "Installing..." spinner while the fetch awaits.

2. **Installers live in `server/installers/`** — Part of the application, not the Docker setup. Works identically when running natively (`npm run dev`) or inside Docker.

3. **Explicit path detection** — The project has `@openai/codex-sdk` as a dependency, which ships a `codex` binary in `node_modules/.bin/`. When the server runs via `npm run dev`, npm adds `node_modules/.bin/` to PATH, causing `command -v codex` to return a false positive. Checking only `/usr/local/bin/`, `/usr/bin/`, and `~/.local/bin/` eliminates this.

4. **Process not killed on client disconnect** — If the browser navigates away during install, the script runs to completion. Only the response writing stops.

## Related Fixes

- **`VITE_IS_PLATFORM` blank page** — Platform mode requires a user in the database for `authenticateToken` middleware. `server/index.js` now auto-creates a `platform` user with completed onboarding on first start when `IS_PLATFORM=true`.

- **`server/routes/mcp.js` crash** — All 5 `claude` CLI spawn handlers had both `close` and `error` listeners sending responses. When the binary was missing (ENOENT), both fired, causing `ERR_HTTP_HEADERS_SENT` which crashed Node. Fixed with `responded` guards on each handler pair.
