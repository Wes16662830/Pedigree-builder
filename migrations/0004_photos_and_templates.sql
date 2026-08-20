-- Adds bird photos and sheet templates. Both are simple additive columns
-- (nullable / defaulted), so — unlike 0003 — a plain ALTER TABLE is enough,
-- no table rebuild needed.
--
-- Apply once against your live database after pulling this update:
--   npm run db:migrate:0004:remote

ALTER TABLE birds ADD COLUMN photo_url TEXT;
ALTER TABLE child_pedigrees ADD COLUMN template TEXT NOT NULL DEFAULT 'classic-gold';
