// Thin adapter over shared/anthropic.ts for the local Express server: builds
// the Anthropic client from the .env-configured key and forwards to the
// framework-agnostic extraction/prose logic. The Cloudflare Worker has its
// own equivalent adapter (worker/lib/anthropic.ts) that builds its client
// from a Worker secret instead — the actual extraction/prose logic in
// shared/anthropic.ts is identical for both.

import Anthropic from '@anthropic-ai/sdk';
import { assertApiKey, EXTRACTION_MODEL, PROSE_MODEL } from '../env.js';
import * as shared from '../../shared/anthropic.js';
import type { SourceFile, ProseInputBird } from '../../shared/anthropic.js';
import type { ExtractedPedigree, PedigreeProse } from '../../shared/types.js';

export type { SourceFile, ProseInputBird };

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) {
    assertApiKey();
    _client = new Anthropic();
  }
  return _client;
}

export function extractPedigree(file: SourceFile): Promise<ExtractedPedigree> {
  return shared.extractPedigree(client(), EXTRACTION_MODEL, file);
}

export function generateProse(childRing: string, tree: ProseInputBird[], lineBreedingSummary: string[]): Promise<PedigreeProse> {
  return shared.generateProse(client(), PROSE_MODEL, childRing, tree, lineBreedingSummary);
}
