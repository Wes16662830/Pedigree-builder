import { Router } from 'express';
import { getAllFolders, createFolder, renameFolder, deleteFolder } from '../db.js';

export const foldersRouter = Router();

foldersRouter.get('/', (_req, res) => {
  res.json(getAllFolders());
});

foldersRouter.post('/', (req, res) => {
  const name = (req.body?.name as string | undefined)?.trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const folder = createFolder(crypto.randomUUID(), name);
  res.status(201).json(folder);
});

foldersRouter.patch('/:id', (req, res) => {
  const name = (req.body?.name as string | undefined)?.trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  renameFolder(req.params.id, name);
  res.json({ ok: true });
});

// Deletes the folder only — pedigrees in it fall back to unfiled.
foldersRouter.delete('/:id', (req, res) => {
  deleteFolder(req.params.id);
  res.status(204).end();
});
