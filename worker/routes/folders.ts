import { Hono } from 'hono';
import { getAllFolders, createFolder, renameFolder, deleteFolder } from '../db.js';
import type { Env } from '../env.js';

export const foldersRouter = new Hono<{ Bindings: Env }>();

foldersRouter.get('/', async (c) => c.json(await getAllFolders(c.env.DB)));

foldersRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim();
  if (!name) return c.json({ error: 'name is required' }, 400);
  const folder = await createFolder(c.env.DB, crypto.randomUUID(), name);
  return c.json(folder, 201);
});

foldersRouter.patch('/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim();
  if (!name) return c.json({ error: 'name is required' }, 400);
  await renameFolder(c.env.DB, c.req.param('id'), name);
  return c.json({ ok: true });
});

foldersRouter.delete('/:id', async (c) => {
  await deleteFolder(c.env.DB, c.req.param('id'));
  return c.body(null, 204);
});
