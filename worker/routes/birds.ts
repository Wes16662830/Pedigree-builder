import { Hono } from 'hono';
import { getAllBirds, getBird, saveBird, deleteBird, getBirdsBySourceFile, setUploadVerified, setBirdPhoto, getAllChildPedigrees } from '../db.js';
import { normaliseRing } from '../../shared/ring.js';
import { walkTree } from '../lib/merge.js';
import type { Bird } from '../../shared/types.js';
import type { Env } from '../env.js';

const PHOTO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

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

// POST /api/birds/:id/photo — stored in R2 under photos/, served back via
// the same /uploads/* route as scans and exports.
birdsRouter.post('/:id/photo', async (c) => {
  const bird = await getBird(c.env.DB, c.req.param('id'));
  if (!bird) return c.json({ error: 'Bird not found' }, 404);

  const form = await c.req.parseBody();
  const file = form['photo'];
  if (!(file instanceof File)) return c.json({ error: 'No photo uploaded. Field name must be "photo".' }, 400);
  if (!PHOTO_MIME.has(file.type)) return c.json({ error: `Unsupported photo type: ${file.type}. Use PNG, JPEG, WEBP, or GIF.` }, 400);
  if (file.size > MAX_PHOTO_BYTES) return c.json({ error: 'Photo too large (8MB max).' }, 400);

  const bytes = await file.arrayBuffer();
  const key = `photos/${bird.id}-${crypto.randomUUID()}-${file.name}`;
  await c.env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: file.type } });

  const photoUrl = `/uploads/${key}`;
  await setBirdPhoto(c.env.DB, bird.id, photoUrl);
  return c.json({ photoUrl });
});

birdsRouter.delete('/:id/photo', async (c) => {
  const bird = await getBird(c.env.DB, c.req.param('id'));
  if (!bird) return c.json({ error: 'Bird not found' }, 404);
  await setBirdPhoto(c.env.DB, bird.id, null);
  return c.body(null, 204);
});

// GET /api/birds/:id/appearances — which child pedigrees this bird shows up
// in, whether as the child itself or anywhere in its ancestor tree.
birdsRouter.get('/:id/appearances', async (c) => {
  const birdId = c.req.param('id');
  const allBirds = await getAllBirds(c.env.DB);
  const index = new Map(allBirds.map((b) => [b.id, b]));
  const rows = await getAllChildPedigrees(c.env.DB);

  const appearances = rows
    .map((row) => {
      const tree = walkTree(row.child_bird_id, index);
      if (!tree.some((b) => b.id === birdId)) return null;
      const child = index.get(row.child_bird_id);
      return {
        childPedigreeId: row.id,
        childBirdId: row.child_bird_id,
        childRing: child?.ring ?? row.child_bird_id,
        childName: child?.name,
        asChild: row.child_bird_id === birdId,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return c.json(appearances);
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
