import { Router } from 'express';
import { getSetting, setSetting, deleteSetting } from '../db.js';
import {
  ANTHROPIC_API_KEY_SETTING,
  maskApiKey,
  LOFT_NAME_SETTING,
  LOFT_SUBTITLE_SETTING,
  LOFT_ADDRESS_SETTING,
  LOFT_LOGO_SETTING,
} from '../../shared/settings.js';
import { ANTHROPIC_API_KEY as ENV_API_KEY } from '../env.js';

export const settingsRouter = Router();

// Data URLs are stored as-is in the settings table (TEXT); cap generously
// server-side too, in case a client ever skips the UI's own size check.
const MAX_LOGO_BYTES = 1024 * 1024;

function status() {
  const dbKey = getSetting(ANTHROPIC_API_KEY_SETTING);
  const apiKey = dbKey
    ? { hasApiKey: true, apiKeyPreview: maskApiKey(dbKey), source: 'settings' as const }
    : ENV_API_KEY
      ? { hasApiKey: true, apiKeyPreview: maskApiKey(ENV_API_KEY), source: 'env' as const }
      : { hasApiKey: false, source: 'none' as const };

  return {
    ...apiKey,
    loft: {
      name: getSetting(LOFT_NAME_SETTING),
      subtitle: getSetting(LOFT_SUBTITLE_SETTING),
      address: getSetting(LOFT_ADDRESS_SETTING),
      logoDataUrl: getSetting(LOFT_LOGO_SETTING),
    },
  };
}

// GET /api/settings — never returns the raw API key, only whether one is
// configured and where it came from (pasted in Settings vs. .env fallback).
settingsRouter.get('/', (_req, res) => {
  res.json(status());
});

// PUT /api/settings — any of: anthropicApiKey, loftName, loftSubtitle,
// loftAddress, loftLogoDataUrl. Only the fields present are written.
settingsRouter.put('/', (req, res) => {
  const body = req.body ?? {};
  const key = (body.anthropicApiKey as string | undefined)?.trim();
  const loftName = body.loftName as string | undefined;
  const loftSubtitle = body.loftSubtitle as string | undefined;
  const loftAddress = body.loftAddress as string | undefined;
  const loftLogoDataUrl = body.loftLogoDataUrl as string | undefined;

  if (key === undefined && loftName === undefined && loftSubtitle === undefined && loftAddress === undefined && loftLogoDataUrl === undefined) {
    res.status(400).json({ error: 'No settings provided.' });
    return;
  }
  if (loftLogoDataUrl !== undefined && loftLogoDataUrl.length > MAX_LOGO_BYTES) {
    res.status(400).json({ error: 'Logo image is too large (1MB max as a data URL).' });
    return;
  }

  if (key) setSetting(ANTHROPIC_API_KEY_SETTING, key);
  if (loftName !== undefined) setSetting(LOFT_NAME_SETTING, loftName);
  if (loftSubtitle !== undefined) setSetting(LOFT_SUBTITLE_SETTING, loftSubtitle);
  if (loftAddress !== undefined) setSetting(LOFT_ADDRESS_SETTING, loftAddress);
  if (loftLogoDataUrl !== undefined) setSetting(LOFT_LOGO_SETTING, loftLogoDataUrl);

  res.json(status());
});

// DELETE /api/settings/api-key — removes the Settings-page key; extraction
// falls back to .env's ANTHROPIC_API_KEY if one is set there.
settingsRouter.delete('/api-key', (_req, res) => {
  deleteSetting(ANTHROPIC_API_KEY_SETTING);
  res.json(status());
});

settingsRouter.delete('/loft-logo', (_req, res) => {
  deleteSetting(LOFT_LOGO_SETTING);
  res.json(status());
});
