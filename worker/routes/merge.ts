import { Hono } from 'hono';
import { getUpload, getChildPedigree, getAllChildPedigrees, getBird } from '../db.js';
import { mergePedigree, getFullTree } from '../lib/merge.js';
import type { Env } from '../env.js';

export const mergeRouter = new Hono<{ Bindings: Env }>();

mergeRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { sireUploadId, damUploadId, child } = body ?? {};
  if (!sireUploadId || !damUploadId || !child?.ring) {
    return c.json({ error: 'sireUploadId, damUploadId, and child.ring are required' }, 400);
  }

  const sireUpload = await getUpload(c.env.DB, sireUploadId);
  const damUpload = await getUpload(c.env.DB, damUploadId);
  if (!sireUpload) return c.json({ error: `Sire upload ${sireUploadId} not found` }, 404);
  if (!damUpload) return c.json({ error: `Dam upload ${damUploadId} not found` }, 404);
  if (!sireUpload.verified || !damUpload.verified) {
    return c.json(
      { error: 'Both uploads must complete Phase 2 verification before merging.', sireVerified: !!sireUpload.verified, damVerified: !!damUpload.verified },
      409,
    );
  }
  if (!sireUpload.root_bird_id || !damUpload.root_bird_id) {
    return c.json({ error: 'Upload is missing its root bird id' }, 500);
  }

  try {
    const result = await mergePedigree(c.env, {
      sireRootId: sireUpload.root_bird_id,
      damRootId: damUpload.root_bird_id,
      child,
      sireUploadId,
      damUploadId,
    });
    return c.json(result);
  } catch (err) {
    console.error('[merge] failed:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Merge failed' }, 500);
  }
});

mergeRouter.get('/', async (c) => c.json(await getAllChildPedigrees(c.env.DB)));

mergeRouter.get('/:id', async (c) => {
  const row = await getChildPedigree(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Child pedigree not found' }, 404);
  const child = await getBird(c.env.DB, row.child_bird_id);
  const tree = await getFullTree(c.env, row.child_bird_id);
  return c.json({
    ...row,
    prose: JSON.parse(row.prose_json),
    layout: row.layout_json ? JSON.parse(row.layout_json) : null,
    child,
    tree,
  });
});
