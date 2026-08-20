import { Hono } from 'hono';
import { getAllBirds } from '../db.js';
import { buildCrossReferenceReport, inbreedingForBird } from '../../shared/crossref.js';
import type { Env } from '../env.js';

export const crossrefRouter = new Hono<{ Bindings: Env }>();

crossrefRouter.get('/', async (c) => {
  const birds = await getAllBirds(c.env.DB);
  return c.json(buildCrossReferenceReport(birds));
});

crossrefRouter.get('/inbreeding/:birdId', async (c) => {
  const birds = await getAllBirds(c.env.DB);
  return c.json(inbreedingForBird(c.req.param('birdId'), birds));
});
