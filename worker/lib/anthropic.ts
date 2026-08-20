// Worker-side adapter over shared/anthropic.ts — mirrors server/lib/anthropic.ts,
// but the client is built fresh per-request from the Worker's env binding
// (there's no long-lived process to hold a singleton in, and the key comes
// from a `wrangler secret`, not a .env file).

import Anthropic from '@anthropic-ai/sdk';
import * as shared from '../../shared/anthropic.js';
import type { SourceFile, ProseInputBird } from '../../shared/anthropic.js';
import type { ExtractedPedigree, PedigreeProse } from '../../shared/types.js';
import { DEFAULT_MODEL, type Env } from '../env.js';

export type { SourceFile, ProseInputBird };

export function extractPedigree(env: Env, file: SourceFile): Promise<ExtractedPedigree> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return shared.extractPedigree(client, env.PEDIGREE_EXTRACTION_MODEL ?? DEFAULT_MODEL, file);
}

export function generateProse(env: Env, childRing: string, tree: ProseInputBird[], lineBreedingSummary: string[]): Promise<PedigreeProse> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return shared.generateProse(client, env.PEDIGREE_PROSE_MODEL ?? DEFAULT_MODEL, childRing, tree, lineBreedingSummary);
}
