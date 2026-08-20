import { Hono } from 'hono';
import { getUpload, getChildPedigree, getAllChildPedigrees, getBird, deleteChildPedigree } from '../db.js';
import { mergePedigree, getFullTree } from '../lib/merge.js';
import type { Env } from '../env.js';

export const mergeRouter = new Hono<{ Bindings: Env }>();

interface MergeSide {
  rootId: string;
  uploadId?: string;
}

async function resolveSide(
  env: Env,
  label: 'sire' | 'dam',
  side: MergeSide | undefined,
): Promise<{ error: string; status: 400 | 404 | 409 } | { rootId: string; uploadId?: string }> {
  if (!side?.rootId) {
    return { error: `${label}.rootId is required`, status: 400 };
  }
  const bird = await getBird(env.DB, side.rootId);
  if (!bird) {
    return { error: `${label} bird ${side.rootId} not found`, status: 404 };
  }
  if (!bird.verified) {
    return { error: `${label}'s bird (${bird.ring}) is not verified yet — finish Phase 2 verification before merging.`, status: 409 };
  }
  if (side.uploadId) {
    const upload = await getUpload(env.DB, side.uploadId);
    if (!upload) return { error: `${label} upload ${side.uploadId} not found`, status: 404 };
  }
  return { rootId: side.rootId, uploadId: side.uploadId };
}

// POST /api/merge — Phase 3. Requires both sides to already be a verified
// bird — either a freshly uploaded+verified pedigree, or a bird already on
// file from an earlier upload/merge, reused as-is.
mergeRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { sire, dam, child } = body ?? {};
  if (!child?.ring) return c.json({ error: 'child.ring is required' }, 400);

  const sireResolved = await resolveSide(c.env, 'sire', sire);
  if ('error' in sireResolved) return c.json({ error: sireResolved.error }, sireResolved.status);
  const damResolved = await resolveSide(c.env, 'dam', dam);
  if ('error' in damResolved) return c.json({ error: damResolved.error }, damResolved.status);

  try {
    const result = await mergePedigree(c.env, {
      sireRootId: sireResolved.rootId,
      damRootId: damResolved.rootId,
      child,
      sireUploadId: sireResolved.uploadId,
      damUploadId: damResolved.uploadId,
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

// Removes the sheet only — the underlying bird/ancestor data stays on file.
mergeRouter.delete('/:id', async (c) => {
  const row = await getChildPedigree(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Child pedigree not found' }, 404);
  await deleteChildPedigree(c.env.DB, c.req.param('id'));
  return c.body(null, 204);
});
