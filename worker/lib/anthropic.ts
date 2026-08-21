// Worker-side adapter over shared/anthropic.ts — mirrors server/lib/anthropic.ts.
// Resolves the API key from the Settings page (D1 `settings` table) first,
// falling back to the `ANTHROPIC_API_KEY` Worker secret if one was set at
// deploy time. Client is built fresh per-request (there's no long-lived
// process to cache it in, the way the Express server can).

import Anthropic from '@anthropic-ai/sdk';
import * as shared from '../../shared/anthropic.js';
import type { SourceFile, ProseInputBird, ExtractedResults } from '../../shared/anthropic.js';
import type { ExtractedPedigree, PedigreeProse } from '../../shared/types.js';
import { ANTHROPIC_API_KEY_SETTING } from '../../shared/settings.js';
import { getSetting } from '../db.js';
import { DEFAULT_MODEL, type Env } from '../env.js';

export type { SourceFile, ProseInputBird, ExtractedResults };

async function resolveApiKey(env: Env): Promise<string> {
  const key = (await getSetting(env.DB, ANTHROPIC_API_KEY_SETTING)) || env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('No Anthropic API key configured. Add one on the Settings page, or set one with `wrangler secret put ANTHROPIC_API_KEY`.');
  }
  return key;
}

export async function extractPedigree(env: Env, file: SourceFile): Promise<ExtractedPedigree> {
  const client = new Anthropic({ apiKey: await resolveApiKey(env) });
  return shared.extractPedigree(client, env.PEDIGREE_EXTRACTION_MODEL ?? DEFAULT_MODEL, file);
}

export async function extractRaceResults(env: Env, file: SourceFile): Promise<ExtractedResults> {
  const client = new Anthropic({ apiKey: await resolveApiKey(env) });
  return shared.extractRaceResults(client, env.PEDIGREE_EXTRACTION_MODEL ?? DEFAULT_MODEL, file);
}

export async function generateProse(env: Env, childRing: string, tree: ProseInputBird[], lineBreedingSummary: string[]): Promise<PedigreeProse> {
  const client = new Anthropic({ apiKey: await resolveApiKey(env) });
  return shared.generateProse(client, env.PEDIGREE_PROSE_MODEL ?? DEFAULT_MODEL, childRing, tree, lineBreedingSummary);
}
