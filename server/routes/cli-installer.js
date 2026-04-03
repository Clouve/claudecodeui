import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

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

/**
 * Run an installer/uninstaller script and collect output.
 * Returns a promise that resolves with { success, message, log, ...status }.
 */
function runScript(scriptPath, client, timeout) {
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

    proc.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        log.push(line);
      }
    });

    proc.stderr.on('data', (data) => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        log.push(line);
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

  try {
    const result = await runScript(scriptPath, client, client.timeout);
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

  try {
    const result = await runScript(scriptPath, client, 60_000);
    const status = await detectClient(provider);
    res.json({ ...result, ...status });
  } catch (error) {
    console.error(`Error uninstalling ${provider}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
