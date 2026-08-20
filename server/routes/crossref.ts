import { Router } from 'express';
import { getAllBirds } from '../db.js';
import { buildCrossReferenceReport, inbreedingForBird } from '../lib/crossref.js';

export const crossrefRouter = Router();

// GET /api/crossref — Phase 5, across the whole collection.
crossrefRouter.get('/', (_req, res) => {
  const birds = getAllBirds();
  res.json(buildCrossReferenceReport(birds));
});

// GET /api/crossref/inbreeding/:birdId — Wright's coefficient for one bird,
// computed from whatever of its tree is in the database.
crossrefRouter.get('/inbreeding/:birdId', (req, res) => {
  const birds = getAllBirds();
  res.json(inbreedingForBird(req.params.birdId, birds));
});
