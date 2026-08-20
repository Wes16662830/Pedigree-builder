// Typed Cloudflare bindings. These names must match wrangler.toml exactly
// (d1_databases[].binding, r2_buckets[].binding, and the ANTHROPIC_API_KEY
// secret set via `wrangler secret put`).

export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  // Optional fallback — the primary path is pasting a key into the Settings
  // page, stored in D1 (see worker/lib/anthropic.ts). Setting this via
  // `wrangler secret put ANTHROPIC_API_KEY` is no longer required.
  ANTHROPIC_API_KEY?: string;
  PEDIGREE_EXTRACTION_MODEL?: string;
  PEDIGREE_PROSE_MODEL?: string;
}

export const DEFAULT_MODEL = 'claude-opus-5';
