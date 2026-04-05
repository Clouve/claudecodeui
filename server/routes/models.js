import express from 'express';
import {
  getAllModels,
  getModels,
  discoverModels,
  refreshIfStale,
} from '../models/model-discovery.js';

const router = express.Router();

const VALID_PROVIDERS = ['claude', 'codex', 'gemini', 'cursor'];

/**
 * GET /
 * Returns model lists for all providers.
 * Refreshes stale caches in the background.
 */
router.get('/', async (_req, res) => {
  // Kick off stale refreshes without blocking the response
  Promise.allSettled(VALID_PROVIDERS.map((p) => refreshIfStale(p))).catch(() => {});

  res.json({ success: true, models: getAllModels() });
});

/**
 * GET /:provider
 * Returns the model list for a single provider.
 * Refreshes if stale (non-blocking).
 */
router.get('/:provider', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }

  // Refresh in background if stale
  refreshIfStale(provider).catch(() => {});

  const models = getModels(provider);
  if (!models) {
    return res.status(404).json({ success: false, error: `No models found for ${provider}` });
  }

  res.json({ success: true, ...models });
});

/**
 * POST /:provider/refresh
 * Force a fresh discovery for a provider (called after install or key save).
 */
router.post('/:provider/refresh', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  }

  const success = await discoverModels(provider);
  const models = getModels(provider);
  res.json({ success, ...models });
});

export default router;
