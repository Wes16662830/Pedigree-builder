import { Router } from 'express';
import { getSetting, setSetting, deleteSetting } from '../db.js';
import { ANTHROPIC_API_KEY_SETTING, maskApiKey } from '../../shared/settings.js';
import { ANTHROPIC_API_KEY as ENV_API_KEY } from '../env.js';

export const settingsRouter = Router();

function status() {
  const dbKey = getSetting(ANTHROPIC_API_KEY_SETTING);
  if (dbKey) return { hasApiKey: true, apiKeyPreview: maskApiKey(dbKey), source: 'settings' as const };
  if (ENV_API_KEY) return { hasApiKey: true, apiKeyPreview: maskApiKey(ENV_API_KEY), source: 'env' as const };
  return { hasApiKey: false, source: 'none' as const };
}

// GET /api/settings — never returns the raw key, only whether one is
// configured and where it came from (pasted in Settings vs. .env fallback).
settingsRouter.get('/', (_req, res) => {
  res.json(status());
});

// PUT /api/settings — body: { anthropicApiKey: string }
settingsRouter.put('/', (req, res) => {
  const key = (req.body?.anthropicApiKey as string | undefined)?.trim();
  if (!key) {
    res.status(400).json({ error: 'anthropicApiKey is required' });
    return;
  }
  setSetting(ANTHROPIC_API_KEY_SETTING, key);
  res.json(status());
});

// DELETE /api/settings/api-key — removes the Settings-page key; extraction
// falls back to .env's ANTHROPIC_API_KEY if one is set there.
settingsRouter.delete('/api-key', (_req, res) => {
  deleteSetting(ANTHROPIC_API_KEY_SETTING);
  res.json(status());
});
