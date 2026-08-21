import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extractPedigree, extractRaceResults } from '../lib/anthropic.js';
import { saveUpload, saveBirds, getUpload } from '../db.js';

const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const ACCEPTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);

const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 }, // matches Claude's 32MB request limit for base64 documents
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Upload a PNG, JPEG, WEBP, GIF, or PDF.`));
      return;
    }
    cb(null, true);
  },
});

// Results screenshots aren't persisted anywhere (unlike pedigree uploads,
// which get their own `uploads` row) — this is a one-shot vision call, so
// there's no reason to accumulate orphan files on disk for it.
const resultsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Upload a PNG, JPEG, WEBP, or GIF screenshot.`));
      return;
    }
    cb(null, true);
  },
});

export const extractRouter = Router();

// POST /api/extract — one pedigree upload -> one vision extraction call.
// Build brief §5 Phase 1: "One API call per parent pedigree."
extractRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
    return;
  }

  try {
    const base64 = fs.readFileSync(req.file.path).toString('base64');
    const extracted = await extractPedigree({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      base64,
    });

    const uploadId = randomUUID();

    // Birds first: uploads.root_bird_id is a foreign key into birds(id), so
    // the bird row has to exist before the upload row can reference it.
    // Also persists immediately so the verification UI has something to
    // load and edit in place; Phase 2 will overwrite fields as the operator
    // corrects them, then flip `verified`.
    saveBirds(extracted.birds);
    saveUpload({
      id: uploadId,
      originalFilename: req.file.originalname,
      storedPath: req.file.path,
      mimeType: req.file.mimetype,
      rootBirdId: extracted.rootBirdId,
      rawExtraction: extracted,
      verified: false,
    });

    res.json({ uploadId, extracted, fileUrl: `/uploads/${path.basename(req.file.path)}` });
  } catch (err) {
    console.error('[extract] failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Extraction failed' });
  }
});

// POST /api/extract/results — one race-history screenshot -> one vision
// call, returning parsed Result[] for the caller to merge into a bird's
// results and let the operator review before it's really saved (build
// brief follow-up: "paste a results extract, add it to the child").
extractRouter.post('/results', resultsUpload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
    return;
  }
  try {
    const base64 = req.file.buffer.toString('base64');
    const extracted = await extractRaceResults({
      filename: req.file.originalname || 'pasted-screenshot.png',
      mimeType: req.file.mimetype,
      base64,
    });
    res.json(extracted);
  } catch (err) {
    console.error('[extract/results] failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Results extraction failed' });
  }
});

// GET /api/extract/:uploadId — fetch a previously extracted upload (its raw
// extraction plus current upload metadata), for re-opening the verify view.
extractRouter.get('/:uploadId', (req, res) => {
  const upload = getUpload(req.params.uploadId);
  if (!upload) {
    res.status(404).json({ error: 'Upload not found' });
    return;
  }
  res.json({
    ...upload,
    rawExtraction: upload.raw_extraction_json ? JSON.parse(upload.raw_extraction_json) : null,
    fileUrl: `/uploads/${path.basename(upload.stored_path)}`,
  });
});
