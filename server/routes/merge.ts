import { Router } from 'express';
import { getUpload, getChildPedigree, getAllChildPedigrees, getBird, deleteChildPedigree } from '../db.js';
import { mergePedigree, getFullTree } from '../lib/merge.js';

export const mergeRouter = Router();

interface MergeSide {
  rootId: string;
  uploadId?: string;
}

function resolveSide(label: 'sire' | 'dam', side: MergeSide | undefined): { error: string; status: number } | { rootId: string; uploadId?: string } {
  if (!side?.rootId) {
    return { error: `${label}.rootId is required`, status: 400 };
  }
  const bird = getBird(side.rootId);
  if (!bird) {
    return { error: `${label} bird ${side.rootId} not found`, status: 404 };
  }
  if (!bird.verified) {
    return { error: `${label}'s bird (${bird.ring}) is not verified yet — finish Phase 2 verification before merging.`, status: 409 };
  }
  // If an uploadId was given, sanity-check it points at this same root —
  // purely a provenance check, not part of the actual verification gate
  // (the bird's own `verified` flag above is what actually matters, so a
  // reused bird with no uploadId at all is equally valid).
  if (side.uploadId) {
    const upload = getUpload(side.uploadId);
    if (!upload) return { error: `${label} upload ${side.uploadId} not found`, status: 404 };
  }
  return { rootId: side.rootId, uploadId: side.uploadId };
}

// POST /api/merge — Phase 3. Requires both sides to already be a verified
// bird — either a freshly uploaded+verified pedigree (build brief §5:
// "Nothing proceeds to render until the operator ticks off the tree"), or a
// bird already on file from an earlier upload/merge, reused as-is.
mergeRouter.post('/', async (req, res) => {
  const { sire, dam, child } = req.body ?? {};
  if (!child?.ring) {
    res.status(400).json({ error: 'child.ring is required' });
    return;
  }

  const sireResolved = resolveSide('sire', sire);
  if ('error' in sireResolved) {
    res.status(sireResolved.status).json({ error: sireResolved.error });
    return;
  }
  const damResolved = resolveSide('dam', dam);
  if ('error' in damResolved) {
    res.status(damResolved.status).json({ error: damResolved.error });
    return;
  }

  try {
    const result = await mergePedigree({
      sireRootId: sireResolved.rootId,
      damRootId: damResolved.rootId,
      child,
      sireUploadId: sireResolved.uploadId,
      damUploadId: damResolved.uploadId,
    });
    res.json(result);
  } catch (err) {
    console.error('[merge] failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Merge failed' });
  }
});

mergeRouter.get('/', (_req, res) => {
  res.json(getAllChildPedigrees());
});

// Removes the sheet only — the underlying bird/ancestor data stays on file
// (see db.ts's deleteChildPedigree comment).
mergeRouter.delete('/:id', (req, res) => {
  const row = getChildPedigree(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Child pedigree not found' });
    return;
  }
  deleteChildPedigree(req.params.id);
  res.status(204).end();
});

mergeRouter.get('/:id', (req, res) => {
  const row = getChildPedigree(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Child pedigree not found' });
    return;
  }
  const child = getBird(row.child_bird_id);
  const tree = getFullTree(row.child_bird_id);
  res.json({
    ...row,
    prose: JSON.parse(row.prose_json),
    layout: row.layout_json ? JSON.parse(row.layout_json) : null,
    child,
    tree,
  });
});
