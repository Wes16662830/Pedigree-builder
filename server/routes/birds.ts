import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getAllBirds, getBird, saveBird, deleteBird, getBirdsBySourceFile, setUploadVerified, setBirdPhoto, getAllChildPedigrees } from '../db.js';
import { normaliseRing } from '../../shared/ring.js';
import { walkTree } from '../lib/merge.js';
import type { Bird } from '../../shared/types.js';

export const birdsRouter = Router();

const photosDir = path.resolve(process.cwd(), 'data', 'uploads', 'photos');
fs.mkdirSync(photosDir, { recursive: true });

const PHOTO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: photosDir,
    filename: (req, file, cb) => cb(null, `${req.params.id}-${randomUUID()}${path.extname(file.originalname) || ''}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!PHOTO_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported photo type: ${file.mimetype}. Use PNG, JPEG, WEBP, or GIF.`));
      return;
    }
    cb(null, true);
  },
});

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

// POST /api/birds/:id/photo — one photo per bird, shown on its Bird Library
// card, in the Pedigrees list thumbnail (for a child bird), and optionally
// on the rendered sheet.
birdsRouter.post('/:id/photo', photoUpload.single('photo'), (req, res) => {
  const bird = getBird(req.params.id);
  if (!bird) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No photo uploaded. Field name must be "photo".' });
    return;
  }
  const photoUrl = `/uploads/photos/${path.basename(req.file.path)}`;
  setBirdPhoto(bird.id, photoUrl);
  res.json({ photoUrl });
});

birdsRouter.delete('/:id/photo', (req, res) => {
  const bird = getBird(req.params.id);
  if (!bird) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }
  setBirdPhoto(bird.id, null);
  res.status(204).end();
});

// GET /api/birds/:id/appearances — which child pedigrees this bird shows up
// in, whether as the child itself or anywhere in its ancestor tree. Powers
// the Bird Library's "where does this bird appear" view.
birdsRouter.get('/:id/appearances', (req, res) => {
  const birdId = req.params.id;
  const allBirds = getAllBirds();
  const index = new Map(allBirds.map((b) => [b.id, b]));
  const rows = getAllChildPedigrees();

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

  res.json(appearances);
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
