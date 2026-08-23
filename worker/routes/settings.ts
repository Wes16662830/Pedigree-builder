import { Hono } from 'hono';
import { getSetting, setSetting, deleteSetting } from '../db.js';
import {
  ANTHROPIC_API_KEY_SETTING,
  maskApiKey,
  LOFT_NAME_SETTING,
  LOFT_SUBTITLE_SETTING,
  LOFT_ADDRESS_SETTING,
  LOFT_PHONE_SETTING,
  LOFT_EMAIL_SETTING,
  LOFT_LOGO_SETTING,
  LOFT_LOGO_SCALE_SETTING,
} from '../../shared/settings.js';
import type { Env } from '../env.js';

export const settingsRouter = new Hono<{ Bindings: Env }>();

const MAX_LOGO_BYTES = 1024 * 1024;
// Matches the Settings page slider (50%-200%) — validated here too in case
// a client ever sends a raw value outside the slider's own range.
const MIN_LOGO_SCALE = 0.5;
const MAX_LOGO_SCALE = 2;

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
      phone: await getSetting(env.DB, LOFT_PHONE_SETTING),
      email: await getSetting(env.DB, LOFT_EMAIL_SETTING),
      logoDataUrl: await getSetting(env.DB, LOFT_LOGO_SETTING),
      logoScale: await getSetting(env.DB, LOFT_LOGO_SCALE_SETTING),
    },
  };
}

settingsRouter.get('/', async (c) => c.json(await status(c.env)));

// PUT /api/settings — any of: anthropicApiKey, loftName, loftSubtitle,
// loftAddress, loftPhone, loftEmail, loftLogoDataUrl, loftLogoScale. Only
// the fields present are written.
settingsRouter.put('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const key = (body?.anthropicApiKey as string | undefined)?.trim();
  const loftName = body?.loftName as string | undefined;
  const loftSubtitle = body?.loftSubtitle as string | undefined;
  const loftAddress = body?.loftAddress as string | undefined;
  const loftPhone = body?.loftPhone as string | undefined;
  const loftEmail = body?.loftEmail as string | undefined;
  const loftLogoDataUrl = body?.loftLogoDataUrl as string | undefined;
  const loftLogoScale = body?.loftLogoScale as string | undefined;

  if (
    key === undefined &&
    loftName === undefined &&
    loftSubtitle === undefined &&
    loftAddress === undefined &&
    loftPhone === undefined &&
    loftEmail === undefined &&
    loftLogoDataUrl === undefined &&
    loftLogoScale === undefined
  ) {
    return c.json({ error: 'No settings provided.' }, 400);
  }
  if (loftLogoDataUrl !== undefined && loftLogoDataUrl.length > MAX_LOGO_BYTES) {
    return c.json({ error: 'Logo image is too large (1MB max as a data URL).' }, 400);
  }
  if (loftLogoScale !== undefined) {
    const n = Number(loftLogoScale);
    if (!Number.isFinite(n) || n < MIN_LOGO_SCALE || n > MAX_LOGO_SCALE) {
      return c.json({ error: `Logo size must be between ${MIN_LOGO_SCALE * 100}% and ${MAX_LOGO_SCALE * 100}%.` }, 400);
    }
  }

  if (key) await setSetting(c.env.DB, ANTHROPIC_API_KEY_SETTING, key);
  if (loftName !== undefined) await setSetting(c.env.DB, LOFT_NAME_SETTING, loftName);
  if (loftSubtitle !== undefined) await setSetting(c.env.DB, LOFT_SUBTITLE_SETTING, loftSubtitle);
  if (loftAddress !== undefined) await setSetting(c.env.DB, LOFT_ADDRESS_SETTING, loftAddress);
  if (loftPhone !== undefined) await setSetting(c.env.DB, LOFT_PHONE_SETTING, loftPhone);
  if (loftEmail !== undefined) await setSetting(c.env.DB, LOFT_EMAIL_SETTING, loftEmail);
  if (loftLogoDataUrl !== undefined) await setSetting(c.env.DB, LOFT_LOGO_SETTING, loftLogoDataUrl);
  if (loftLogoScale !== undefined) await setSetting(c.env.DB, LOFT_LOGO_SCALE_SETTING, loftLogoScale);

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
