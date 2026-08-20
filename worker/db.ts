// D1 access layer — the Cloudflare equivalent of server/db.ts. Same schema
// (schema.sql / migrations/0001_init.sql), same row<->Bird mapping, but
// async (D1 is a fetch-based binding, not a synchronous local file) and
// takes the D1Database binding as an explicit argument rather than holding
// a module-level singleton, since bindings only exist per-request in a
// Worker.

import type { Bird, Result, Sex } from '../shared/types.js';

interface BirdRow {
  id: string;
  ring: string;
  ring_normalised: string | null;
  name: string | null;
  colour: string | null;
  sex: Sex;
  breeder: string | null;
  loft_address: string | null;
  notes_json: string;
  notes_en_json: string | null;
  results_json: string;
  sire_id: string | null;
  dam_id: string | null;
  source_file: string | null;
  confidence: number;
  verified: number;
  created_at: string;
  updated_at: string;
}

function rowToBird(row: BirdRow): Bird {
  return {
    id: row.id,
    ring: row.ring,
    ringNormalised: row.ring_normalised ?? undefined,
    name: row.name ?? undefined,
    colour: row.colour ?? undefined,
    sex: row.sex,
    breeder: row.breeder ?? undefined,
    loftAddress: row.loft_address ?? undefined,
    notes: JSON.parse(row.notes_json ?? '[]'),
    notesEn: row.notes_en_json ? JSON.parse(row.notes_en_json) : undefined,
    results: JSON.parse(row.results_json ?? '[]') as Result[],
    sireId: row.sire_id ?? undefined,
    damId: row.dam_id ?? undefined,
    sourceFile: row.source_file ?? undefined,
    confidence: row.confidence,
    verified: !!row.verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveBird(db: D1Database, bird: Bird): Promise<void> {
  await db
    .prepare(
      `INSERT INTO birds (id, ring, ring_normalised, name, colour, sex, breeder, loft_address,
                          notes_json, notes_en_json, results_json, sire_id, dam_id, source_file,
                          confidence, verified, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(id) DO UPDATE SET
         ring = excluded.ring,
         ring_normalised = excluded.ring_normalised,
         name = excluded.name,
         colour = excluded.colour,
         sex = excluded.sex,
         breeder = excluded.breeder,
         loft_address = excluded.loft_address,
         notes_json = excluded.notes_json,
         notes_en_json = excluded.notes_en_json,
         results_json = excluded.results_json,
         sire_id = excluded.sire_id,
         dam_id = excluded.dam_id,
         source_file = excluded.source_file,
         confidence = excluded.confidence,
         verified = excluded.verified,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(
      bird.id,
      bird.ring,
      bird.ringNormalised ?? null,
      bird.name ?? null,
      bird.colour ?? null,
      bird.sex,
      bird.breeder ?? null,
      bird.loftAddress ?? null,
      JSON.stringify(bird.notes ?? []),
      bird.notesEn ? JSON.stringify(bird.notesEn) : null,
      JSON.stringify(bird.results ?? []),
      bird.sireId ?? null,
      bird.damId ?? null,
      bird.sourceFile ?? null,
      bird.confidence,
      bird.verified ? 1 : 0,
    )
    .run();
}

export async function saveBirds(db: D1Database, birds: Bird[]): Promise<void> {
  // D1 doesn't support better-sqlite3-style sync transactions; sequential
  // awaits are fine here — batches are small (one pedigree tree at a time).
  for (const b of birds) await saveBird(db, b);
}

export async function getBird(db: D1Database, id: string): Promise<Bird | undefined> {
  const row = await db.prepare('SELECT * FROM birds WHERE id = ?').bind(id).first<BirdRow>();
  return row ? rowToBird(row) : undefined;
}

export async function getAllBirds(db: D1Database): Promise<Bird[]> {
  const { results } = await db.prepare('SELECT * FROM birds ORDER BY created_at').all<BirdRow>();
  return results.map(rowToBird);
}

export async function getBirdsBySourceFile(db: D1Database, sourceFile: string): Promise<Bird[]> {
  const { results } = await db.prepare('SELECT * FROM birds WHERE source_file = ?').bind(sourceFile).all<BirdRow>();
  return results.map(rowToBird);
}

export async function deleteBird(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM birds WHERE id = ?').bind(id).run();
}

// ---- uploads ---------------------------------------------------------------

export interface UploadRow {
  id: string;
  original_filename: string;
  stored_path: string; // R2 object key, in the Worker
  mime_type: string | null;
  root_bird_id: string | null;
  raw_extraction_json: string | null;
  verified: number;
  created_at: string;
  updated_at: string;
}

export async function saveUpload(
  db: D1Database,
  u: {
    id: string;
    originalFilename: string;
    storedPath: string;
    mimeType?: string;
    rootBirdId?: string;
    rawExtraction?: unknown;
    verified?: boolean;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO uploads (id, original_filename, stored_path, mime_type, root_bird_id, raw_extraction_json, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         root_bird_id = excluded.root_bird_id,
         raw_extraction_json = excluded.raw_extraction_json,
         verified = excluded.verified,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(
      u.id,
      u.originalFilename,
      u.storedPath,
      u.mimeType ?? null,
      u.rootBirdId ?? null,
      u.rawExtraction ? JSON.stringify(u.rawExtraction) : null,
      u.verified ? 1 : 0,
    )
    .run();
}

export async function getUpload(db: D1Database, id: string): Promise<UploadRow | undefined> {
  const row = await db.prepare('SELECT * FROM uploads WHERE id = ?').bind(id).first<UploadRow>();
  return row ?? undefined;
}

export async function setUploadVerified(db: D1Database, id: string, verified: boolean): Promise<void> {
  await db
    .prepare(`UPDATE uploads SET verified = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .bind(verified ? 1 : 0, id)
    .run();
}

// ---- child pedigrees ---------------------------------------------------------------

export interface ChildPedigreeRow {
  id: string;
  child_bird_id: string;
  sire_upload_id: string;
  dam_upload_id: string;
  prose_json: string;
  layout_json: string | null;
  ring_field_order: string;
  print_variant: string;
  created_at: string;
  updated_at: string;
}

export async function saveChildPedigree(
  db: D1Database,
  row: {
    id: string;
    childBirdId: string;
    sireUploadId: string;
    damUploadId: string;
    prose: unknown;
    layout?: unknown;
    ringFieldOrder?: string;
    printVariant?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO child_pedigrees (id, child_bird_id, sire_upload_id, dam_upload_id, prose_json, layout_json, ring_field_order, print_variant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         prose_json = excluded.prose_json,
         layout_json = excluded.layout_json,
         ring_field_order = excluded.ring_field_order,
         print_variant = excluded.print_variant,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(
      row.id,
      row.childBirdId,
      row.sireUploadId,
      row.damUploadId,
      JSON.stringify(row.prose ?? {}),
      row.layout ? JSON.stringify(row.layout) : null,
      row.ringFieldOrder ?? 'ring-year',
      row.printVariant ?? 'black-header',
    )
    .run();
}

export async function getChildPedigree(db: D1Database, id: string): Promise<ChildPedigreeRow | undefined> {
  const row = await db.prepare('SELECT * FROM child_pedigrees WHERE id = ?').bind(id).first<ChildPedigreeRow>();
  return row ?? undefined;
}

export async function getAllChildPedigrees(db: D1Database): Promise<ChildPedigreeRow[]> {
  const { results } = await db.prepare('SELECT * FROM child_pedigrees ORDER BY created_at DESC').all<ChildPedigreeRow>();
  return results;
}

// ---- settings ---------------------------------------------------------------
// Same free-form key/value store as server/db.ts — see that file's comment.
// This is what lets the Anthropic API key be pasted in on the Settings page
// instead of requiring a `wrangler secret put` at deploy time.

export async function getSetting(db: D1Database, key: string): Promise<string | undefined> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(key, value)
    .run();
}

export async function deleteSetting(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
}
