import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getChildPedigree, saveChildPedigree, getBird, setChildPedigreeFolder } from '../db.js';

export const exportRouter = Router();

const exportsDir = path.resolve(process.cwd(), 'data', 'exports');
fs.mkdirSync(exportsDir, { recursive: true });

// PATCH /api/pedigrees/:id — Phase 4 layout-mode edits (box position/scale),
// ring field-order setting, print variant. Keeps the same "everything is
// editable, edits persist" behaviour as the original HTML template.
exportRouter.patch('/:id', (req, res) => {
  const row = getChildPedigree(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Child pedigree not found' });
    return;
  }
  const { layout, ringFieldOrder, printVariant, prose, folderId } = req.body ?? {};
  saveChildPedigree({
    id: row.id,
    childBirdId: row.child_bird_id,
    sireUploadId: row.sire_upload_id ?? undefined,
    damUploadId: row.dam_upload_id ?? undefined,
    prose: prose ?? JSON.parse(row.prose_json),
    layout: layout ?? (row.layout_json ? JSON.parse(row.layout_json) : undefined),
    ringFieldOrder: ringFieldOrder ?? row.ring_field_order,
    printVariant: printVariant ?? row.print_variant,
  });
  // folderId is handled separately (a plain UPDATE, not part of the upsert
  // above) so `undefined` reliably means "not part of this request" while
  // `null` means "move to unfiled" — folderId?: string | null in the body.
  if (folderId !== undefined) {
    setChildPedigreeFolder(row.id, folderId);
  }
  res.json({ ok: true });
});

// POST /api/pedigrees/:id/export — writes the self-contained HTML file
// (with edits baked in as inline styles, produced client-side) to disk
// under data/exports. Build brief §4: "Export writes a self-contained HTML
// file with edits baked in as inline styles."
exportRouter.post('/:id/export', (req, res) => {
  const row = getChildPedigree(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Child pedigree not found' });
    return;
  }
  const html = req.body?.html as string | undefined;
  if (!html) {
    res.status(400).json({ error: 'body.html is required' });
    return;
  }
  const child = getBird(row.child_bird_id);
  const safeRing = (child?.ring ?? row.id).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `${safeRing}-${Date.now()}.html`;
  const filePath = path.join(exportsDir, filename);
  fs.writeFileSync(filePath, html, 'utf-8');
  res.json({ ok: true, path: filePath, filename });
});
