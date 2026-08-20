-- Adds folders (Pedigrees list organisation) and loosens child_pedigrees so
-- a side can be a reused already-verified bird instead of a fresh upload.
-- SQLite/D1 can't ALTER a column's NOT NULL away directly, so this rebuilds
-- child_pedigrees — the standard SQLite pattern for that. Nothing else has
-- a foreign key pointing at child_pedigrees, so this is safe to run as-is.
--
-- Apply once against your live database after pulling this update:
--   npm run db:migrate:0003:remote

CREATE TABLE IF NOT EXISTS folders (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE child_pedigrees_new (
  id                TEXT PRIMARY KEY,
  child_bird_id     TEXT NOT NULL REFERENCES birds(id),
  sire_upload_id    TEXT REFERENCES uploads(id),
  dam_upload_id     TEXT REFERENCES uploads(id),
  prose_json        TEXT NOT NULL DEFAULT '{}',
  layout_json        TEXT,
  ring_field_order  TEXT NOT NULL DEFAULT 'ring-year' CHECK (ring_field_order IN ('ring-year','year-ring')),
  print_variant     TEXT NOT NULL DEFAULT 'black-header' CHECK (print_variant IN ('black-header','white-panel')),
  folder_id         TEXT REFERENCES folders(id),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO child_pedigrees_new (id, child_bird_id, sire_upload_id, dam_upload_id, prose_json, layout_json, ring_field_order, print_variant, folder_id, created_at, updated_at)
SELECT id, child_bird_id, sire_upload_id, dam_upload_id, prose_json, layout_json, ring_field_order, print_variant, NULL, created_at, updated_at
FROM child_pedigrees;

DROP TABLE child_pedigrees;
ALTER TABLE child_pedigrees_new RENAME TO child_pedigrees;

CREATE INDEX IF NOT EXISTS idx_child_pedigrees_folder ON child_pedigrees(folder_id);
