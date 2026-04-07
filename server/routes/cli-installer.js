import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { discoverModels } from '../models/model-discovery.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the installers directory relative to this file (server/routes/ → server/installers/).
const INSTALLERS_DIR = path.resolve(__dirname, '..', 'installers');

// Map provider id → binary detection and script paths.
const CLIENT_REGISTRY = {
  claude: {
    name: 'Claude Code',
    detectPaths: () => [
      path.join(os.homedir(), '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
    ],
    versionArgs: ['--version'],
    installScript: 'claude/install.sh',
    uninstallScript: 'claude/uninstall.sh',
    timeout: 120_000,
  },
  cursor: {
    name: 'Cursor CLI',
    detectPaths: () => [
      path.join(os.homedir(), '.local', 'bin', 'agent'),
      '/usr/local/bin/agent',
    ],
    versionArgs: ['--version'],
    installScript: 'cursor/install.sh',
    uninstallScript: 'cursor/uninstall.sh',
    timeout: 120_000,
  },
  gemini: {
    name: 'Gemini CLI',
    detectPaths: () => [
      '/usr/local/bin/gemini',
      '/usr/bin/gemini',
    ],
    versionArgs: ['--version'],
    installScript: 'gemini/install.sh',
    uninstallScript: 'gemini/uninstall.sh',
    timeout: 180_000,
  },
  codex: {
    name: 'Codex CLI',
    detectPaths: () => [
      '/usr/local/bin/codex',
      '/usr/bin/codex',
    ],
    versionArgs: ['--version'],
    installScript: 'codex/install.sh',
    uninstallScript: 'codex/uninstall.sh',
    timeout: 180_000,
  },
  taskmaster: {
    name: 'TaskMaster AI',
    detectPaths: () => [
      '/usr/local/bin/task-master',
      '/usr/bin/task-master',
    ],
    versionArgs: ['--version'],
    installScript: 'taskmaster/install.sh',
    uninstallScript: 'taskmaster/uninstall.sh',
    timeout: 180_000,
  },
};

// Map provider id → environment variable name for API key and validation config.
// keyFile: path on the persistent /home volume where the key is saved so it
// survives container restarts. entrypoint.sh restores from the same files.
const KEY_CONFIG = {
  claude: {
    envVar: 'ANTHROPIC_API_KEY',
    keyFile: path.join(os.homedir(), '.anthropic_api_key'),
    validateUrl: 'https://api.anthropic.com/v1/models',
    buildHeaders: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    buildParams: null,
  },
  gemini: {
    envVar: 'GEMINI_API_KEY',
    keyFile: path.join(os.homedir(), '.gemini_api_key'),
    validateUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    buildHeaders: null,
    buildParams: (key) => `key=${encodeURIComponent(key)}`,
  },
  codex: {
    envVar: 'OPENAI_API_KEY',
    keyFile: path.join(os.homedir(), '.openai_api_key'),
    validateUrl: 'https://api.openai.com/v1/models',
    buildHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    buildParams: null,
  },
  cursor: {
    envVar: 'CURSOR_API_KEY',
    keyFile: path.join(os.homedir(), '.cursor_api_key'),
    validateUrl: null, // Cursor has no REST validation endpoint
    buildHeaders: null,
    buildParams: null,
  },
};

const VALID_PROVIDERS = Object.keys(CLIENT_REGISTRY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a file is executable */
async function fileIsExecutable(filePath) {
  try {
    await fs.access(filePath, 1 /* fs.constants.X_OK */);
    return true;
  } catch {
    return false;
  }
}

/** Get the installed version of a CLI by running --version */
function getVersion(cmd, args) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(cmd, args, { stdio: 'pipe', timeout: 5000 });
      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { output += d.toString(); });
      proc.on('close', () => resolve(output.trim().split('\n')[0] || null));
      proc.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Detect whether a specific AI client is installed by checking known
 * binary paths. This avoids false positives from node_modules/.bin/
 * binaries that npm adds to PATH when running via `npm run dev`.
 */
async function detectClient(provider) {
  const client = CLIENT_REGISTRY[provider];
  if (!client) return { installed: false };

  const paths = client.detectPaths();
  for (const binPath of paths) {
    if (await fileIsExecutable(binPath)) {
      const version = await getVersion(binPath, client.versionArgs);
      return { installed: true, version, path: binPath };
    }
  }

  return { installed: false };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /status
 * Returns install status for all providers.
 */
router.get('/status', async (_req, res) => {
  try {
    const results = {};
    await Promise.all(
      VALID_PROVIDERS.map(async (provider) => {
        results[provider] = await detectClient(provider);
      }),
    );
    res.json({ success: true, clients: results });
  } catch (error) {
    console.error('Error checking install status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /:provider/status
 * Returns install status for a single provider.
 */
router.get('/:provider/status', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }

  try {
    const result = await detectClient(provider);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`Error checking ${provider} install status:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Mask an API key for safe display: show last 4 chars */
function maskKey(key) {
  if (!key || key.length < 5) return '••••••••';
  return '••••••••' + key.slice(-4);
}

// ---------------------------------------------------------------------------
// Routes — key status & validation
// ---------------------------------------------------------------------------

/**
 * GET /key-status
 * Returns per-provider API key availability (env var detection).
 */
router.get('/key-status', (_req, res) => {
  try {
    const result = {};
    for (const [provider, cfg] of Object.entries(KEY_CONFIG)) {
      const envValue = process.env[cfg.envVar]?.trim() || '';
      result[provider] = {
        available: Boolean(envValue),
        source: envValue ? 'env' : null,
        masked: envValue ? maskKey(envValue) : null,
        envVar: cfg.envVar,
      };
    }
    res.json({ success: true, keys: result });
  } catch (error) {
    console.error('Error checking key status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /:provider/validate-key
 * Validates an API key against the provider's API.
 * Body: { apiKey: string }
 * Returns: { valid: boolean, error?: string }
 *
 * For Cursor: always returns valid (no REST validation endpoint).
 */
router.post('/:provider/validate-key', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ valid: false, error: `Unknown provider: ${provider}` });
  }

  const { apiKey } = req.body || {};
  const cfg = KEY_CONFIG[provider];

  if (!cfg) {
    return res.json({ valid: false, error: 'No key configuration for this provider' });
  }

  // Cursor has no REST validation endpoint — accept unconditionally.
  if (!cfg.validateUrl) {
    return res.json({ valid: true, error: null });
  }

  if (!apiKey || !apiKey.trim()) {
    return res.json({ valid: false, error: 'API key is required' });
  }

  const trimmedKey = apiKey.trim();
  let url = cfg.validateUrl;
  if (cfg.buildParams) {
    url += '?' + cfg.buildParams(trimmedKey);
  }

  try {
    const headers = cfg.buildHeaders ? cfg.buildHeaders(trimmedKey) : {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      return res.json({ valid: true, error: null });
    }

    return res.json({
      valid: false,
      error: `Key rejected by provider (HTTP ${response.status})`,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.json({ valid: false, error: 'Network error — could not reach provider API' });
    }
    return res.json({ valid: false, error: `Network error — ${error.message}` });
  }
});

/**
 * POST /:provider/save-key
 * Persists a validated API key as a process-level environment variable so that
 * child processes (install scripts, CLI tools) can read it at runtime. Also
 * writes the key to a file on the persistent /home volume so it survives
 * container restarts (entrypoint.sh restores from the same files on startup).
 * Body: { apiKey: string }
 */
router.post('/:provider/save-key', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }

  const { apiKey } = req.body || {};
  const cfg = KEY_CONFIG[provider];

  if (!cfg) {
    return res.json({ success: false, error: 'No key configuration for this provider' });
  }

  if (!apiKey || !apiKey.trim()) {
    return res.json({ success: false, error: 'API key is required' });
  }

  const trimmed = apiKey.trim();
  process.env[cfg.envVar] = trimmed;

  // Persist to the /home volume so entrypoint.sh can restore on restart.
  if (cfg.keyFile) {
    try {
      await fs.writeFile(cfg.keyFile, trimmed, { mode: 0o600 });
    } catch { /* best-effort — key is still in process.env for this session */ }
  }

  // Re-discover models now that the API key is available
  discoverModels(provider).catch(() => {});

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Routes — install / uninstall
// ---------------------------------------------------------------------------

/** Broadcast a message to all connected WebSocket clients. */
function broadcast(wss, message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      try { client.send(payload); } catch { /* ignore */ }
    }
  });
}

/**
 * Run an installer/uninstaller script and collect output.
 * Each stdout/stderr line is also broadcast via WebSocket as an `install_log`
 * event so the frontend can display progress in real time.
 *
 * Returns a promise that resolves with { success, message, log }.
 */
function runScript(scriptPath, client, timeout, { wss, provider, action } = {}) {
  return new Promise((resolve) => {
    const log = [];

    const proc = spawn('bash', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${os.homedir()}/.local/bin:/usr/local/bin:${process.env.PATH}` },
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ success: false, message: `Timed out after ${timeout / 1000}s`, log });
    }, timeout);

    const pushLine = (line) => {
      log.push(line);
      broadcast(wss, { type: 'install_log', provider, action, line });
    };

    proc.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        pushLine(line);
      }
    });

    proc.stderr.on('data', (data) => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        pushLine(line);
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        message: code === 0 ? `${client.name} completed successfully.` : `${client.name} failed (exit code ${code}).`,
        log,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({ success: false, message: `Failed to start: ${error.message}`, log });
    });
  });
}

/**
 * Run provider-specific post-install authentication.
 * Some CLIs (e.g. Codex) require an explicit login step to register the API
 * key, unlike Claude/Gemini which read the key directly from the environment.
 */
/** Resolve the first executable binary path for a provider. */
async function resolveBin(provider, fallback) {
  const paths = CLIENT_REGISTRY[provider]?.detectPaths() || [];
  for (const p of paths) {
    if (await fileIsExecutable(p)) return p;
  }
  return fallback;
}

/** Spawn a CLI command, stream output via WebSocket, and optionally pipe stdin. */
function runCliCommand(bin, args, { wss, provider, stdin, timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${os.homedir()}/.local/bin:/usr/local/bin:${process.env.PATH}` },
    });

    let output = '';
    const pushLine = (line) => {
      output += line + '\n';
      broadcast(wss, { type: 'install_log', provider, action: 'install', line });
    };

    proc.stdout.on('data', (d) => {
      for (const line of d.toString().split('\n').filter(Boolean)) pushLine(line);
    });
    proc.stderr.on('data', (d) => {
      for (const line of d.toString().split('\n').filter(Boolean)) pushLine(line);
    });

    if (stdin != null) {
      proc.stdin.write(stdin + '\n');
      proc.stdin.end();
    }

    const timer = setTimeout(() => { proc.kill('SIGTERM'); resolve({ code: null, output }); }, timeout);
    proc.on('close', (code) => { clearTimeout(timer); resolve({ code, output }); });
    proc.on('error', () => { clearTimeout(timer); resolve({ code: null, output }); });
  });
}

/**
 * Run provider-specific post-install authentication.
 * Some CLIs (e.g. Codex, Cursor) require an explicit login step to register
 * the API key, unlike Claude/Gemini which read the key directly from env.
 */
async function postInstallAuth(provider, wss) {
  const cfg = KEY_CONFIG[provider];
  if (!cfg) return;

  const apiKey = process.env[cfg.envVar]?.trim();
  if (!apiKey) return;

  const pushLine = (line) => {
    broadcast(wss, { type: 'install_log', provider, action: 'install', line });
  };

  // Codex: pipe the API key to `codex login --with-api-key`
  if (provider === 'codex') {
    const bin = await resolveBin('codex', 'codex');
    pushLine('Authenticating Codex CLI with API key...');
    await runCliCommand(bin, ['login', '--with-api-key'], { wss, provider, stdin: apiKey, timeout: 15_000 });
    pushLine('Codex CLI authenticated.');
  }

  // Cursor: the CLI reads CURSOR_API_KEY from the environment automatically.
  // Just verify authentication via `agent status`.
  if (provider === 'cursor') {
    const bin = await resolveBin('cursor', 'agent');
    pushLine('Verifying Cursor CLI authentication...');

    const statusResult = await runCliCommand(bin, ['status'], { wss, provider, timeout: 15_000 });
    if (/not authenticated|invalid|error/i.test(statusResult.output)) {
      pushLine('WARNING: Cursor API key verification failed — agent may not be authenticated.');
    } else {
      pushLine('Cursor API key verified.');
    }
  }
}

/**
 * POST /:provider/install
 * Installs a provider CLI. Returns JSON when the install finishes.
 */
router.post('/:provider/install', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }

  const client = CLIENT_REGISTRY[provider];
  const scriptPath = path.join(INSTALLERS_DIR, client.installScript);
  const wss = req.app.locals.wss;

  try {
    const result = await runScript(scriptPath, client, client.timeout, { wss, provider, action: 'install' });

    // Run provider-specific post-install auth (e.g. codex login --with-api-key)
    if (result.success) {
      await postInstallAuth(provider, wss);
      // Discover available models now that the CLI is installed
      discoverModels(provider).catch(() => {});
    }

    const status = await detectClient(provider);
    res.json({ ...result, ...status });
  } catch (error) {
    console.error(`Error installing ${provider}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /:provider/uninstall
 * Uninstalls a provider CLI. Returns JSON when the uninstall finishes.
 */
router.post('/:provider/uninstall', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }

  const client = CLIENT_REGISTRY[provider];
  const scriptPath = path.join(INSTALLERS_DIR, client.uninstallScript);
  const wss = req.app.locals.wss;

  try {
    const result = await runScript(scriptPath, client, 60_000, { wss, provider, action: 'uninstall' });
    const status = await detectClient(provider);
    res.json({ ...result, ...status });
  } catch (error) {
    console.error(`Error uninstalling ${provider}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
