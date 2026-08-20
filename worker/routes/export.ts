import { Hono } from 'hono';
import { getChildPedigree, saveChildPedigree, getBird, setChildPedigreeFolder } from '../db.js';
import type { Env } from '../env.js';

export const exportRouter = new Hono<{ Bindings: Env }>();

// PATCH /api/pedigrees/:id — Phase 4 layout-mode edits, ring field-order,
// print variant.
exportRouter.patch('/:id', async (c) => {
  const row = await getChildPedigree(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Child pedigree not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const { layout, ringFieldOrder, printVariant, prose, folderId } = body ?? {};
  await saveChildPedigree(c.env.DB, {
    id: row.id,
    childBirdId: row.child_bird_id,
    sireUploadId: row.sire_upload_id ?? undefined,
    damUploadId: row.dam_upload_id ?? undefined,
    prose: prose ?? JSON.parse(row.prose_json),
    layout: layout ?? (row.layout_json ? JSON.parse(row.layout_json) : undefined),
    ringFieldOrder: ringFieldOrder ?? row.ring_field_order,
    printVariant: printVariant ?? row.print_variant,
  });
  // undefined = "not part of this request"; null = "move to unfiled".
  if (folderId !== undefined) {
    await setChildPedigreeFolder(c.env.DB, row.id, folderId);
  }
  return c.json({ ok: true });
});

// POST /api/pedigrees/:id/export — writes the self-contained exported HTML
// to R2 (under an exports/ prefix in the same bucket as uploads) instead of
// local disk. The browser download is what actually matters here; this is
// just a server-side copy for convenience.
exportRouter.post('/:id/export', async (c) => {
  const row = await getChildPedigree(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Child pedigree not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const html = body?.html as string | undefined;
  if (!html) return c.json({ error: 'body.html is required' }, 400);

  const child = await getBird(c.env.DB, row.child_bird_id);
  const safeRing = (child?.ring ?? row.id).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const key = `exports/${safeRing}-${Date.now()}.html`;
  await c.env.UPLOADS.put(key, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  return c.json({ ok: true, path: key, filename: key.split('/').pop() });
});
