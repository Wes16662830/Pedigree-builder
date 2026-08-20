import 'dotenv/config';

// Build brief §3/§8: the API key lives here (server-side, .env) and is never
// exposed to the frontend. The frontend only ever talks to our own /api/*
// routes, which hold this key and proxy calls to Anthropic.

export const PORT = Number(process.env.PORT ?? 8787);

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const EXTRACTION_MODEL = process.env.PEDIGREE_EXTRACTION_MODEL ?? 'claude-opus-5';
export const PROSE_MODEL = process.env.PEDIGREE_PROSE_MODEL ?? 'claude-opus-5';

if (!ANTHROPIC_API_KEY) {
  // Non-fatal at import time — routes that need it check `assertApiKey()`
  // themselves, so `npm run db:seed` and other DB-only scripts still work
  // without a key configured.
  console.warn('[env] ANTHROPIC_API_KEY is not set. Extraction and prose routes will fail until it is configured in .env.');
}

export function assertApiKey(): string {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  return ANTHROPIC_API_KEY;
}
