import { Hono } from 'hono';
import { getAllBirds, getBird, saveBird, deleteBird, getBirdsBySourceFile, setUploadVerified } from '../db.js';
import { normaliseRing } from '../../shared/ring.js';
import type { Bird } from '../../shared/types.js';
import type { Env } from '../env.js';

export const birdsRouter = new Hono<{ Bindings: Env }>();

birdsRouter.get('/', async (c) => c.json(await getAllBirds(c.env.DB)));

birdsRouter.get('/by-source/:sourceFile', async (c) => c.json(await getBirdsBySourceFile(c.env.DB, decodeURIComponent(c.req.param('sourceFile')))));

birdsRouter.get('/:id', async (c) => {
  const bird = await getBird(c.env.DB, c.req.param('id'));
  if (!bird) return c.json({ error: 'Bird not found' }, 404);
  return c.json(bird);
});

// PUT /api/birds/:id — Phase 2 verification edits.
birdsRouter.put('/:id', async (c) => {
  const existing = await getBird(c.env.DB, c.req.param('id'));
  if (!existing) return c.json({ error: 'Bird not found' }, 404);
  const patch = (await c.req.json()) as Partial<Bird>;
  const merged: Bird = {
    ...existing,
    ...patch,
    id: existing.id,
    ring: patch.ring ?? existing.ring,
    ringNormalised: patch.ring ? normaliseRing(patch.ring) : existing.ringNormalised,
  };
  await saveBird(c.env.DB, merged);
  return c.json(merged);
});

birdsRouter.post('/:id/verify', async (c) => {
  const existing = await getBird(c.env.DB, c.req.param('id'));
  if (!existing) return c.json({ error: 'Bird not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const verified = body?.verified ?? true;
  const updated = { ...existing, verified };
  await saveBird(c.env.DB, updated);
  return c.json(updated);
});

birdsRouter.delete('/:id', async (c) => {
  await deleteBird(c.env.DB, c.req.param('id'));
  return c.body(null, 204);
});

birdsRouter.post('/upload/:uploadId/complete-verification', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sourceFile = body?.sourceFile as string | undefined;
  if (!sourceFile) return c.json({ error: 'sourceFile is required in body' }, 400);

  const birds = await getBirdsBySourceFile(c.env.DB, sourceFile);
  const unverified = birds.filter((b) => !b.verified);
  if (unverified.length > 0) {
    return c.json({ error: 'Not all birds in this pedigree are verified yet.', unverifiedIds: unverified.map((b) => b.id) }, 409);
  }
  await setUploadVerified(c.env.DB, c.req.param('uploadId'), true);
  return c.json({ ok: true });
});
