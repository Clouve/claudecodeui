/**
 * Dynamic Model Discovery
 *
 * Queries provider REST APIs (Anthropic, OpenAI, Google) and the Cursor CLI
 * to discover available models at runtime. The cache starts empty and is
 * populated exclusively from live API/CLI responses — no hardcoded model
 * lists exist in the codebase.
 *
 * @module models/model-discovery
 */

import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs/promises';

const VALID_PROVIDERS = ['claude', 'codex', 'gemini', 'cursor'];

// ─── In-memory cache ────────────────────────────────────────────────────────

/** @type {Map<string, { options: Array<{value: string, label: string}>, default: string, discoveredAt: string | null }>} */
const cache = new Map();

/** Cache TTL — re-discover after 6 hours */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** @type {Map<string, number>} last successful discovery timestamp per provider */
const lastDiscovered = new Map();

// ─── Provider fetchers ──────────────────────────────────────────────────────

/**
 * Fetch models from the Anthropic REST API.
 * GET https://api.anthropic.com/v1/models
 *
 * Claude Code SDK accepts full model IDs from the API (e.g. claude-sonnet-4-6).
 */
async function fetchAnthropicModels(apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const models = body.data || [];

  const codingRelevant = models.filter((m) => {
    const id = m.id || '';
    if (!id.startsWith('claude-')) return false;
    if (/instant|embed/i.test(id)) return false;
    return true;
  });

  if (codingRelevant.length === 0) return null;

  // Remove date-stamped snapshots when a base model exists.
  // e.g. keep "claude-sonnet-4-6" but drop "claude-sonnet-4-6-20250514".
  const baseIds = new Set(codingRelevant.map((m) => m.id));
  const filtered = codingRelevant.filter((m) => {
    const match = m.id.match(/^(.+)-\d{8}$/);
    if (match && baseIds.has(match[1])) return false;
    return true;
  });

  const options = filtered.map((m) => ({
    value: m.id,
    label: m.display_name || m.id,
  }));

  // Sort: opus > sonnet > haiku, then by version desc.
  options.sort((a, b) => {
    const rank = (v) => {
      if (/opus/i.test(v)) return 0;
      if (/sonnet/i.test(v)) return 1;
      if (/haiku/i.test(v)) return 2;
      return 3;
    };
    const diff = rank(a.value) - rank(b.value);
    if (diff !== 0) return diff;
    return b.value.localeCompare(a.value);
  });

  return options.length > 0 ? options : null;
}

/**
 * Fetch models from the OpenAI REST API.
 * GET https://api.openai.com/v1/models
 */
async function fetchOpenAIModels(apiKey) {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const models = body.data || [];

  // Keep GPT models relevant to coding (gpt-4+, gpt-5+, codex, o-series)
  const codingRelevant = models.filter((m) => {
    const id = m.id || '';
    if (/^gpt-(4|5)/i.test(id)) return true;
    if (/codex/i.test(id)) return true;
    if (/^o[1-9]/i.test(id)) return true;
    return false;
  });

  if (codingRelevant.length === 0) return null;

  // Remove variants that are just date-stamped snapshots when a base exists.
  // e.g. keep "gpt-5.4" but drop "gpt-5.4-2026-03-15" if both exist.
  const baseIds = new Set(codingRelevant.map((m) => m.id));
  const filtered = codingRelevant.filter((m) => {
    const match = m.id.match(/^(.+)-\d{4}-\d{2}-\d{2}$/);
    if (match && baseIds.has(match[1])) return false;
    return true;
  });

  const options = filtered.map((m) => ({
    value: m.id,
    label: formatOpenAILabel(m.id),
  }));

  options.sort((a, b) => b.value.localeCompare(a.value));

  return options.length > 0 ? options : null;
}

/** Produce a human-friendly label from an OpenAI model ID. */
function formatOpenAILabel(id) {
  return id
    .replace(/^gpt-/i, 'GPT-')
    .replace(/^o(\d)/i, 'o$1')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Gpt/g, 'GPT');
}

/**
 * Fetch models from the Google Generative Language API.
 * GET https://generativelanguage.googleapis.com/v1beta/models?key=KEY
 */
async function fetchGeminiModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const body = await res.json();
  const models = body.models || [];

  // Keep Gemini models that support content generation (not just embedding).
  const codingRelevant = models.filter((m) => {
    const name = m.name || '';
    if (!name.includes('gemini')) return false;
    const methods = m.supportedGenerationMethods || [];
    if (!methods.includes('generateContent')) return false;
    // Skip very old or tuning-only models
    if (/tuning|1\.0|aqa/i.test(name)) return false;
    return true;
  });

  if (codingRelevant.length === 0) return null;

  const options = codingRelevant.map((m) => {
    // name is "models/gemini-2.5-pro", strip the "models/" prefix
    const value = (m.name || '').replace(/^models\//, '');
    return {
      value,
      label: m.displayName || value,
    };
  });

  // Sort: pro before flash, newer versions first.
  options.sort((a, b) => {
    const rank = (v) => {
      if (/pro/i.test(v)) return 0;
      if (/flash(?!.*lite)/i.test(v)) return 1;
      if (/lite/i.test(v)) return 2;
      return 3;
    };
    const diff = rank(a.value) - rank(b.value);
    if (diff !== 0) return diff;
    return b.value.localeCompare(a.value);
  });

  return options.length > 0 ? options : null;
}

/** Strip ANSI escape sequences from a string. */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/** Lines that are CLI chrome, not model entries. */
const CURSOR_NOISE_PATTERNS = [
  /^loading\b/i,
  /^no models\b/i,
  /^error\b/i,
  /^authentication required/i,
  /^available models/i,
  /^tip:/i,
  /^\s*$/,
];

/**
 * Discover Cursor models via CLI.
 * Runs `agent models` and parses the output, stripping ANSI escape codes
 * from the spinner/progress animation the CLI emits.
 *
 * Output format per line: `model-id - Display Name` with an optional
 * `(default)` suffix on one entry.
 */
async function fetchCursorModels() {
  const binPaths = [
    `${os.homedir()}/.local/bin/agent`,
    '/usr/local/bin/agent',
  ];

  let bin = null;
  for (const p of binPaths) {
    try {
      await fs.access(p, 1 /* X_OK */);
      bin = p;
      break;
    } catch { /* not found */ }
  }
  if (!bin) return null;

  return new Promise((resolve) => {
    const proc = spawn(bin, ['models'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${os.homedir()}/.local/bin:/usr/local/bin:${process.env.PATH}` },
      timeout: 15_000,
    });

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) return resolve(null);

      // Strip ANSI escape codes, then split into lines and filter noise
      const cleaned = stripAnsi(stdout);
      const lines = cleaned.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !CURSOR_NOISE_PATTERNS.some((re) => re.test(l)));

      if (lines.length === 0) return resolve(null);

      let defaultId = null;
      const options = lines.map((line) => {
        // Format: "model-id - Display Name  (default)"
        const match = line.match(/^(\S+)\s+-\s+(.+)$/);
        if (!match) return null;

        const id = match[1];
        let label = match[2].trim();

        if (/\(default\)/i.test(label)) {
          defaultId = id;
          label = label.replace(/\s*\(default\)/i, '').trim();
        }

        return { value: id, label };
      }).filter(Boolean);

      if (options.length === 0) return resolve(null);

      // Stash the CLI's default so discoverModels can use it.
      options._defaultId = defaultId;
      resolve(options);
    });
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run model discovery for a single provider.
 * Fetches from the appropriate API/CLI and updates the in-memory cache.
 *
 * @param {string} provider - 'claude' | 'codex' | 'gemini' | 'cursor'
 * @returns {Promise<boolean>} true if discovery succeeded
 */
export async function discoverModels(provider) {
  if (!VALID_PROVIDERS.includes(provider)) return false;

  try {
    let discovered = null;

    if (provider === 'claude') {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (key) discovered = await fetchAnthropicModels(key);
    } else if (provider === 'codex') {
      const key = process.env.OPENAI_API_KEY?.trim();
      if (key) discovered = await fetchOpenAIModels(key);
    } else if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY?.trim();
      if (key) discovered = await fetchGeminiModels(key);
    } else if (provider === 'cursor') {
      discovered = await fetchCursorModels();
    }

    if (discovered && discovered.length > 0) {
      // Cursor's fetchCursorModels stashes the CLI-reported default on _defaultId.
      const cliDefault = discovered._defaultId;
      delete discovered._defaultId;

      cache.set(provider, {
        options: discovered,
        default: cliDefault || discovered[0].value,
        discoveredAt: new Date().toISOString(),
      });
      lastDiscovered.set(provider, Date.now());
      console.log(`[model-discovery] ${provider}: discovered ${discovered.length} models`);
      return true;
    }
  } catch (err) {
    console.warn(`[model-discovery] ${provider}: discovery failed —`, err.message);
  }

  return false;
}

/**
 * Run model discovery for all providers in parallel.
 * Safe to call on startup — failures are logged but don't throw.
 */
export async function discoverAllModels() {
  await Promise.allSettled(VALID_PROVIDERS.map((p) => discoverModels(p)));
}

/**
 * Get the current model list for a provider (from cache).
 *
 * @param {string} provider
 * @returns {{ options: Array<{value: string, label: string}>, default: string, discoveredAt: string | null } | null}
 */
export function getModels(provider) {
  return cache.get(provider) || null;
}

/**
 * Get the default model for a provider (first discovered model, or null).
 * @param {string} provider
 * @returns {string | null}
 */
export function getDefaultModel(provider) {
  return cache.get(provider)?.default || null;
}

/**
 * Get model lists for all providers.
 * @returns {Record<string, { options: Array<{value: string, label: string}>, default: string, discoveredAt: string | null }>}
 */
export function getAllModels() {
  return Object.fromEntries(cache);
}

/**
 * Check if a provider's cache is stale (older than TTL).
 * @param {string} provider
 * @returns {boolean}
 */
export function isCacheStale(provider) {
  const ts = lastDiscovered.get(provider);
  if (!ts) return true;
  return Date.now() - ts > CACHE_TTL_MS;
}

/**
 * Refresh a provider's models if the cache is stale.
 * @param {string} provider
 */
export async function refreshIfStale(provider) {
  if (isCacheStale(provider)) {
    await discoverModels(provider);
  }
}
