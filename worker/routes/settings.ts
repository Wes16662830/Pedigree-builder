import { Hono } from 'hono';
import { getSetting, setSetting, deleteSetting } from '../db.js';
import { ANTHROPIC_API_KEY_SETTING, maskApiKey } from '../../shared/settings.js';
import type { Env } from '../env.js';

export const settingsRouter = new Hono<{ Bindings: Env }>();

async function status(env: Env) {
  const dbKey = await getSetting(env.DB, ANTHROPIC_API_KEY_SETTING);
  if (dbKey) return { hasApiKey: true, apiKeyPreview: maskApiKey(dbKey), source: 'settings' as const };
  if (env.ANTHROPIC_API_KEY) return { hasApiKey: true, apiKeyPreview: maskApiKey(env.ANTHROPIC_API_KEY), source: 'env' as const };
  return { hasApiKey: false, source: 'none' as const };
}

settingsRouter.get('/', async (c) => c.json(await status(c.env)));

settingsRouter.put('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const key = (body?.anthropicApiKey as string | undefined)?.trim();
  if (!key) return c.json({ error: 'anthropicApiKey is required' }, 400);
  await setSetting(c.env.DB, ANTHROPIC_API_KEY_SETTING, key);
  return c.json(await status(c.env));
});

settingsRouter.delete('/api-key', async (c) => {
  await deleteSetting(c.env.DB, ANTHROPIC_API_KEY_SETTING);
  return c.json(await status(c.env));
});
