// Typed Cloudflare bindings. These names must match wrangler.toml exactly
// (d1_databases[].binding, r2_buckets[].binding, and the ANTHROPIC_API_KEY
// secret set via `wrangler secret put`).

export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  ANTHROPIC_API_KEY: string;
  PEDIGREE_EXTRACTION_MODEL?: string;
  PEDIGREE_PROSE_MODEL?: string;
}

export const DEFAULT_MODEL = 'claude-opus-5';
