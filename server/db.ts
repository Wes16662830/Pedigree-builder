import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bird, Result, Sex } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = process.env.PEDIGREE_DB_PATH ?? path.join(DATA_DIR, 'birds.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'exports'), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.resolve(__dirname, '..', 'schema.sql'), 'utf-8');
db.exec(schema);

// ---- row <-> Bird mapping -------------------------------------------------

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

const upsertStmt = db.prepare(`
  INSERT INTO birds (id, ring, ring_normalised, name, colour, sex, breeder, loft_address,
                      notes_json, notes_en_json, results_json, sire_id, dam_id, source_file,
                      confidence, verified, updated_at)
  VALUES (@id, @ring, @ringNormalised, @name, @colour, @sex, @breeder, @loftAddress,
          @notesJson, @notesEnJson, @resultsJson, @sireId, @damId, @sourceFile,
          @confidence, @verified, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
`);

export function saveBird(bird: Bird): void {
  upsertStmt.run({
    id: bird.id,
    ring: bird.ring,
    ringNormalised: bird.ringNormalised ?? null,
    name: bird.name ?? null,
    colour: bird.colour ?? null,
    sex: bird.sex,
    breeder: bird.breeder ?? null,
    loftAddress: bird.loftAddress ?? null,
    notesJson: JSON.stringify(bird.notes ?? []),
    notesEnJson: bird.notesEn ? JSON.stringify(bird.notesEn) : null,
    resultsJson: JSON.stringify(bird.results ?? []),
    sireId: bird.sireId ?? null,
    damId: bird.damId ?? null,
    sourceFile: bird.sourceFile ?? null,
    confidence: bird.confidence,
    verified: bird.verified ? 1 : 0,
  });
}

export function saveBirds(birds: Bird[]): void {
  const tx = db.transaction((list: Bird[]) => {
    for (const b of list) saveBird(b);
  });
  tx(birds);
}

export function getBird(id: string): Bird | undefined {
  const row = db.prepare('SELECT * FROM birds WHERE id = ?').get(id) as BirdRow | undefined;
  return row ? rowToBird(row) : undefined;
}

export function getAllBirds(): Bird[] {
  const rows = db.prepare('SELECT * FROM birds ORDER BY created_at').all() as BirdRow[];
  return rows.map(rowToBird);
}

export function getBirdsBySourceFile(sourceFile: string): Bird[] {
  const rows = db.prepare('SELECT * FROM birds WHERE source_file = ?').all(sourceFile) as BirdRow[];
  return rows.map(rowToBird);
}

export function findByRingNormalised(ringNormalised: string): Bird[] {
  const rows = db.prepare('SELECT * FROM birds WHERE ring_normalised = ?').all(ringNormalised) as BirdRow[];
  return rows.map(rowToBird);
}

export function deleteBird(id: string): void {
  db.prepare('DELETE FROM birds WHERE id = ?').run(id);
}

// ---- uploads ---------------------------------------------------------------

export interface UploadRow {
  id: string;
  original_filename: string;
  stored_path: string;
  mime_type: string | null;
  root_bird_id: string | null;
  raw_extraction_json: string | null;
  verified: number;
  created_at: string;
  updated_at: string;
}

export function saveUpload(u: {
  id: string;
  originalFilename: string;
  storedPath: string;
  mimeType?: string;
  rootBirdId?: string;
  rawExtraction?: unknown;
  verified?: boolean;
}): void {
  db.prepare(`
    INSERT INTO uploads (id, original_filename, stored_path, mime_type, root_bird_id, raw_extraction_json, verified)
    VALUES (@id, @originalFilename, @storedPath, @mimeType, @rootBirdId, @rawExtraction, @verified)
    ON CONFLICT(id) DO UPDATE SET
      root_bird_id = excluded.root_bird_id,
      raw_extraction_json = excluded.raw_extraction_json,
      verified = excluded.verified,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run({
    id: u.id,
    originalFilename: u.originalFilename,
    storedPath: u.storedPath,
    mimeType: u.mimeType ?? null,
    rootBirdId: u.rootBirdId ?? null,
    rawExtraction: u.rawExtraction ? JSON.stringify(u.rawExtraction) : null,
    verified: u.verified ? 1 : 0,
  });
}

export function getUpload(id: string): UploadRow | undefined {
  return db.prepare('SELECT * FROM uploads WHERE id = ?').get(id) as UploadRow | undefined;
}

export function setUploadVerified(id: string, verified: boolean): void {
  db.prepare(`UPDATE uploads SET verified = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(verified ? 1 : 0, id);
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

export function saveChildPedigree(row: {
  id: string;
  childBirdId: string;
  sireUploadId: string;
  damUploadId: string;
  prose: unknown;
  layout?: unknown;
  ringFieldOrder?: string;
  printVariant?: string;
}): void {
  db.prepare(`
    INSERT INTO child_pedigrees (id, child_bird_id, sire_upload_id, dam_upload_id, prose_json, layout_json, ring_field_order, print_variant)
    VALUES (@id, @childBirdId, @sireUploadId, @damUploadId, @proseJson, @layoutJson, @ringFieldOrder, @printVariant)
    ON CONFLICT(id) DO UPDATE SET
      prose_json = excluded.prose_json,
      layout_json = excluded.layout_json,
      ring_field_order = excluded.ring_field_order,
      print_variant = excluded.print_variant,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run({
    id: row.id,
    childBirdId: row.childBirdId,
    sireUploadId: row.sireUploadId,
    damUploadId: row.damUploadId,
    proseJson: JSON.stringify(row.prose ?? {}),
    layoutJson: row.layout ? JSON.stringify(row.layout) : null,
    ringFieldOrder: row.ringFieldOrder ?? 'ring-year',
    printVariant: row.printVariant ?? 'black-header',
  });
}

export function getChildPedigree(id: string): ChildPedigreeRow | undefined {
  return db.prepare('SELECT * FROM child_pedigrees WHERE id = ?').get(id) as ChildPedigreeRow | undefined;
}

export function getAllChildPedigrees(): ChildPedigreeRow[] {
  return db.prepare('SELECT * FROM child_pedigrees ORDER BY created_at DESC').all() as ChildPedigreeRow[];
}
