import 'dotenv/config';

// Build brief §3/§8: the API key is held server-side and never exposed to
// the frontend — the frontend only ever talks to our own /api/* routes.
// Where the key actually comes from: the Settings page (stored in the
// `settings` table, see server/db.ts + server/lib/anthropic.ts) takes
// priority; ANTHROPIC_API_KEY here is only a fallback default for local
// dev convenience, so `.env` remains optional, not required.

export const PORT = Number(process.env.PORT ?? 8787);

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const EXTRACTION_MODEL = process.env.PEDIGREE_EXTRACTION_MODEL ?? 'claude-opus-5';
export const PROSE_MODEL = process.env.PEDIGREE_PROSE_MODEL ?? 'claude-opus-5';

if (!ANTHROPIC_API_KEY) {
  // Non-fatal — server/lib/anthropic.ts checks the Settings-page key too,
  // so `npm run db:seed` and other DB-only scripts don't need either one,
  // and extraction still works if a key gets pasted into Settings at runtime.
  console.warn('[env] ANTHROPIC_API_KEY is not set in .env. That\'s fine if you plan to add a key on the Settings page instead.');
}
