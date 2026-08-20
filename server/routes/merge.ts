import { Router } from 'express';
import { getUpload, getChildPedigree, getAllChildPedigrees, getBird } from '../db.js';
import { mergePedigree, getFullTree } from '../lib/merge.js';

export const mergeRouter = Router();

// POST /api/merge — Phase 3. Requires both uploads to have passed Phase 2
// verification (build brief §5: "Nothing proceeds to render until the
// operator ticks off the tree").
mergeRouter.post('/', async (req, res) => {
  const { sireUploadId, damUploadId, child } = req.body ?? {};
  if (!sireUploadId || !damUploadId || !child?.ring) {
    res.status(400).json({ error: 'sireUploadId, damUploadId, and child.ring are required' });
    return;
  }

  const sireUpload = getUpload(sireUploadId);
  const damUpload = getUpload(damUploadId);
  if (!sireUpload) {
    res.status(404).json({ error: `Sire upload ${sireUploadId} not found` });
    return;
  }
  if (!damUpload) {
    res.status(404).json({ error: `Dam upload ${damUploadId} not found` });
    return;
  }
  if (!sireUpload.verified || !damUpload.verified) {
    res.status(409).json({
      error: 'Both uploads must complete Phase 2 verification before merging.',
      sireVerified: !!sireUpload.verified,
      damVerified: !!damUpload.verified,
    });
    return;
  }
  if (!sireUpload.root_bird_id || !damUpload.root_bird_id) {
    res.status(500).json({ error: 'Upload is missing its root bird id' });
    return;
  }

  try {
    const result = await mergePedigree({
      sireRootId: sireUpload.root_bird_id,
      damRootId: damUpload.root_bird_id,
      child,
      sireUploadId,
      damUploadId,
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
