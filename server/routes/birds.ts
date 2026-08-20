import { Router } from 'express';
import { getAllBirds, getBird, saveBird, deleteBird, getBirdsBySourceFile, setUploadVerified } from '../db.js';
import { normaliseRing } from '../../shared/ring.js';
import type { Bird } from '../../shared/types.js';

export const birdsRouter = Router();

birdsRouter.get('/', (_req, res) => {
  res.json(getAllBirds());
});

birdsRouter.get('/by-source/:sourceFile', (req, res) => {
  res.json(getBirdsBySourceFile(req.params.sourceFile));
});

birdsRouter.get('/:id', (req, res) => {
  const bird = getBird(req.params.id);
  if (!bird) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }
  res.json(bird);
});

// PUT /api/birds/:id — Phase 2 verification edits land here. The operator
// corrects fields in the split-screen UI; each save is a full overwrite of
// the editable fields (ring stays verbatim, ringNormalised is recomputed).
birdsRouter.put('/:id', (req, res) => {
  const existing = getBird(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }
  const patch = req.body as Partial<Bird>;
  const merged: Bird = {
    ...existing,
    ...patch,
    id: existing.id, // never reassignable via patch
    ring: patch.ring ?? existing.ring,
    ringNormalised: patch.ring ? normaliseRing(patch.ring) : existing.ringNormalised,
  };
  saveBird(merged);
  res.json(merged);
});

// POST /api/birds/:id/verify — mark one bird confirmed by a human. This does
// NOT mark the whole upload verified — that requires every bird in the tree
// to be ticked off (build brief §5 Phase 2: "Nothing proceeds to render
// until the operator ticks off the tree").
birdsRouter.post('/:id/verify', (req, res) => {
  const existing = getBird(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }
  const verified = req.body?.verified ?? true;
  saveBird({ ...existing, verified });
  res.json({ ...existing, verified });
});

birdsRouter.delete('/:id', (req, res) => {
  deleteBird(req.params.id);
  res.status(204).end();
});

// POST /api/birds/upload/:uploadId/complete-verification — call once every
// bird from that upload's tree has been ticked off. Rejects if any aren't.
birdsRouter.post('/upload/:uploadId/complete-verification', (req, res) => {
  const sourceFile = req.body?.sourceFile as string | undefined;
  if (!sourceFile) {
    res.status(400).json({ error: 'sourceFile is required in body' });
    return;
  }
  const birds = getBirdsBySourceFile(sourceFile);
  const unverified = birds.filter((b) => !b.verified);
  if (unverified.length > 0) {
    res.status(409).json({
      error: 'Not all birds in this pedigree are verified yet.',
      unverifiedIds: unverified.map((b) => b.id),
    });
    return;
  }
  setUploadVerified(req.params.uploadId, true);
  res.json({ ok: true });
});
