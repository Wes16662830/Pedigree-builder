import { Hono } from 'hono';
import { extractPedigree } from '../lib/anthropic.js';
import { saveUpload, saveBirds, getUpload } from '../db.js';
import type { Env } from '../env.js';

const ACCEPTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const MAX_BYTES = 32 * 1024 * 1024; // matches Claude's 32MB base64-document limit

export const extractRouter = new Hono<{ Bindings: Env }>();

// POST /api/extract — one pedigree upload -> one vision extraction call
// (build brief §5 Phase 1). The scan itself goes to R2; extraction goes
// straight to D1, same as the local server writes to disk + SQLite.
extractRouter.post('/', async (c) => {
  const form = await c.req.parseBody();
  const file = form['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'No file uploaded. Field name must be "file".' }, 400);
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return c.json({ error: `Unsupported file type: ${file.type}. Upload a PNG, JPEG, WEBP, GIF, or PDF.` }, 400);
  }
  if (file.size > MAX_BYTES) {
    return c.json({ error: 'File too large (32MB max).' }, 400);
  }

  const bytes = await file.arrayBuffer();
  const uploadId = crypto.randomUUID();
  const objectKey = `${uploadId}-${file.name}`;

  try {
    await c.env.UPLOADS.put(objectKey, bytes, { httpMetadata: { contentType: file.type } });

    const base64 = Buffer.from(bytes).toString('base64');
    const extracted = await extractPedigree(c.env, { filename: file.name, mimeType: file.type, base64 });

    await saveUpload(c.env.DB, {
      id: uploadId,
      originalFilename: file.name,
      storedPath: objectKey,
      mimeType: file.type,
      rootBirdId: extracted.rootBirdId,
      rawExtraction: extracted,
      verified: false,
    });
    await saveBirds(c.env.DB, extracted.birds);

    return c.json({ uploadId, extracted, fileUrl: `/uploads/${objectKey}` });
  } catch (err) {
    console.error('[extract] failed:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, 500);
  }
});

extractRouter.get('/:uploadId', async (c) => {
  const upload = await getUpload(c.env.DB, c.req.param('uploadId'));
  if (!upload) return c.json({ error: 'Upload not found' }, 404);
  return c.json({
    ...upload,
    rawExtraction: upload.raw_extraction_json ? JSON.parse(upload.raw_extraction_json) : null,
    fileUrl: `/uploads/${upload.stored_path}`,
  });
});
