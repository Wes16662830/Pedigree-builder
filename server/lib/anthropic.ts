// Thin adapter over shared/anthropic.ts for the local Express server.
// Resolves the API key from the Settings page first (settings table), then
// falls back to .env's ANTHROPIC_API_KEY — so the app works either way:
// paste a key into Settings, or set it once in .env, whichever is easier.
// The Cloudflare Worker has its own equivalent adapter
// (worker/lib/anthropic.ts, settings table -> Worker secret fallback); the
// actual extraction/prose logic in shared/anthropic.ts is identical for both.

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY as ENV_API_KEY, EXTRACTION_MODEL, PROSE_MODEL } from '../env.js';
import { getSetting } from '../db.js';
import { ANTHROPIC_API_KEY_SETTING } from '../../shared/settings.js';
import * as shared from '../../shared/anthropic.js';
import type { SourceFile, ProseInputBird, ExtractedResults } from '../../shared/anthropic.js';
import type { ExtractedPedigree, PedigreeProse } from '../../shared/types.js';

export type { SourceFile, ProseInputBird, ExtractedResults };

function resolveApiKey(): string {
  const key = getSetting(ANTHROPIC_API_KEY_SETTING) || ENV_API_KEY;
  if (!key) {
    throw new Error('No Anthropic API key configured. Add one on the Settings page, or set ANTHROPIC_API_KEY in .env.');
  }
  return key;
}

// Cache the client, but rebuild it if the resolved key changes (e.g. the
// operator just saved a new one on the Settings page) — avoids re-creating
// a fresh client on every single request.
let _client: Anthropic | undefined;
let _clientKey: string | undefined;
function client(): Anthropic {
  const key = resolveApiKey();
  if (!_client || _clientKey !== key) {
    _client = new Anthropic({ apiKey: key });
    _clientKey = key;
  }
  return _client;
}

export function extractPedigree(file: SourceFile): Promise<ExtractedPedigree> {
  return shared.extractPedigree(client(), EXTRACTION_MODEL, file);
}

export function extractRaceResults(file: SourceFile): Promise<ExtractedResults> {
  return shared.extractRaceResults(client(), EXTRACTION_MODEL, file);
}

export function generateProse(childRing: string, tree: ProseInputBird[], lineBreedingSummary: string[]): Promise<PedigreeProse> {
  return shared.generateProse(client(), PROSE_MODEL, childRing, tree, lineBreedingSummary);
}
