import { Hono } from 'hono';
import { getSetting, setSetting, deleteSetting } from '../db.js';
import {
  ANTHROPIC_API_KEY_SETTING,
  maskApiKey,
  LOFT_NAME_SETTING,
  LOFT_SUBTITLE_SETTING,
  LOFT_ADDRESS_SETTING,
  LOFT_LOGO_SETTING,
} from '../../shared/settings.js';
import type { Env } from '../env.js';

export const settingsRouter = new Hono<{ Bindings: Env }>();

const MAX_LOGO_BYTES = 1024 * 1024;

async function status(env: Env) {
  const dbKey = await getSetting(env.DB, ANTHROPIC_API_KEY_SETTING);
  const apiKey = dbKey
    ? { hasApiKey: true, apiKeyPreview: maskApiKey(dbKey), source: 'settings' as const }
    : env.ANTHROPIC_API_KEY
      ? { hasApiKey: true, apiKeyPreview: maskApiKey(env.ANTHROPIC_API_KEY), source: 'env' as const }
      : { hasApiKey: false, source: 'none' as const };

  return {
    ...apiKey,
    loft: {
      name: await getSetting(env.DB, LOFT_NAME_SETTING),
      subtitle: await getSetting(env.DB, LOFT_SUBTITLE_SETTING),
      address: await getSetting(env.DB, LOFT_ADDRESS_SETTING),
      logoDataUrl: await getSetting(env.DB, LOFT_LOGO_SETTING),
    },
  };
}

settingsRouter.get('/', async (c) => c.json(await status(c.env)));

// PUT /api/settings — any of: anthropicApiKey, loftName, loftSubtitle,
// loftAddress, loftLogoDataUrl. Only the fields present are written.
settingsRouter.put('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const key = (body?.anthropicApiKey as string | undefined)?.trim();
  const loftName = body?.loftName as string | undefined;
  const loftSubtitle = body?.loftSubtitle as string | undefined;
  const loftAddress = body?.loftAddress as string | undefined;
  const loftLogoDataUrl = body?.loftLogoDataUrl as string | undefined;

  if (key === undefined && loftName === undefined && loftSubtitle === undefined && loftAddress === undefined && loftLogoDataUrl === undefined) {
    return c.json({ error: 'No settings provided.' }, 400);
  }
  if (loftLogoDataUrl !== undefined && loftLogoDataUrl.length > MAX_LOGO_BYTES) {
    return c.json({ error: 'Logo image is too large (1MB max as a data URL).' }, 400);
  }

  if (key) await setSetting(c.env.DB, ANTHROPIC_API_KEY_SETTING, key);
  if (loftName !== undefined) await setSetting(c.env.DB, LOFT_NAME_SETTING, loftName);
  if (loftSubtitle !== undefined) await setSetting(c.env.DB, LOFT_SUBTITLE_SETTING, loftSubtitle);
  if (loftAddress !== undefined) await setSetting(c.env.DB, LOFT_ADDRESS_SETTING, loftAddress);
  if (loftLogoDataUrl !== undefined) await setSetting(c.env.DB, LOFT_LOGO_SETTING, loftLogoDataUrl);

  return c.json(await status(c.env));
});

settingsRouter.delete('/api-key', async (c) => {
  await deleteSetting(c.env.DB, ANTHROPIC_API_KEY_SETTING);
  return c.json(await status(c.env));
});

settingsRouter.delete('/loft-logo', async (c) => {
  await deleteSetting(c.env.DB, LOFT_LOGO_SETTING);
  return c.json(await status(c.env));
});
