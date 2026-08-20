// Vision extraction (Phase 1) and prose generation (Phase 3). Framework-
// agnostic on purpose: it takes an already-constructed Anthropic client and
// a model id rather than reading env vars or holding a singleton, so the
// same logic runs unchanged from the local Express server (server/env.ts)
// and the Cloudflare Worker (worker/env.ts) — the only thing that differs
// between them is *where the API key comes from*, never the extraction or
// prose logic itself.

import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt, PROSE_SYSTEM_PROMPT } from './prompts.js';
import { normaliseRing } from './ring.js';
import type { Bird, ExtractedPedigree, PedigreeProse } from './types.js';

// ---- Phase 1: extraction ---------------------------------------------------

const ResultSchema = z.object({
  race: z.string(),
  distanceKm: z.number().nullable(),
  year: z.number().nullable(),
  position: z.number().nullable(),
  poolSize: z.number().nullable(),
  federation: z.string().nullable(),
  raw: z.string().describe('Verbatim source text for this result line'),
});

const ExtractedBirdSchema = z.object({
  localId: z.string().describe('Short id you choose, e.g. "b0", "b1" — used only to link sireRef/damRef within this response'),
  ring: z.string().describe('Verbatim ring number exactly as printed. Best-effort transcription if unclear, with confidence lowered accordingly.'),
  name: z.string().nullable(),
  colour: z.string().nullable(),
  sex: z.enum(['cock', 'hen', 'unknown']),
  breeder: z.string().nullable(),
  loftAddress: z.string().nullable(),
  notes: z.array(z.string()).describe('Verbatim source wording, one entry per distinct prose claim about this bird'),
  notesEn: z.array(z.string()).describe('English translation of notes, same order, one-to-one. Empty array if source is already English.'),
  results: z.array(ResultSchema),
  sireRef: z.string().nullable().describe("localId of this bird's sire elsewhere in this list, or null if not shown"),
  damRef: z.string().nullable().describe("localId of this bird's dam elsewhere in this list, or null if not shown"),
  generation: z.number().int().min(0).describe('0 = pedigree subject, 1 = parents, 2 = grandparents, ...'),
  confidence: z.number().min(0).max(1),
});

const ExtractionResultSchema = z.object({
  rootLocalId: z.string().describe('localId of the pedigree subject bird (generation 0)'),
  birds: z.array(ExtractedBirdSchema),
  extractionNotes: z.string().describe('Caveats about the scan itself (illegible regions, cropping, low resolution). Empty string if none.'),
});

export interface SourceFile {
  filename: string;
  mimeType: string; // 'image/png', 'image/jpeg', 'application/pdf', ...
  base64: string;
}

function contentBlockFor(file: SourceFile): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (file.mimeType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
    };
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: file.mimeType as Anthropic.Base64ImageSource['media_type'], data: file.base64 },
  };
}

/**
 * Phase 1 — extract the full ancestor tree from one uploaded parent
 * pedigree. One API call per upload (brief §5). Returns birds with fresh
 * UUIDs and `verified: false` — nothing here is trusted until Phase 2.
 */
export async function extractPedigree(client: Anthropic, model: string, file: SourceFile): Promise<ExtractedPedigree> {
  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [contentBlockFor(file), { type: 'text', text: extractionUserPrompt(file.filename) }],
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionResultSchema), effort: 'high' },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Extraction failed to parse into the expected schema. Try re-uploading, or a clearer scan.');
  }

  const idMap = new Map<string, string>(); // localId -> real uuid
  for (const b of parsed.birds) idMap.set(b.localId, crypto.randomUUID());

  const birds: Bird[] = parsed.birds.map((b) => ({
    id: idMap.get(b.localId)!,
    ring: b.ring,
    ringNormalised: normaliseRing(b.ring),
    name: b.name ?? undefined,
    colour: b.colour ?? undefined,
    sex: b.sex,
    breeder: b.breeder ?? undefined,
    loftAddress: b.loftAddress ?? undefined,
    notes: b.notes,
    notesEn: b.notesEn.length ? b.notesEn : undefined,
    results: b.results.map((r) => ({
      race: r.race,
      distanceKm: r.distanceKm ?? undefined,
      year: r.year ?? undefined,
      position: r.position ?? undefined,
      poolSize: r.poolSize ?? undefined,
      federation: r.federation ?? undefined,
      raw: r.raw,
    })),
    sireId: b.sireRef ? idMap.get(b.sireRef) : undefined,
    damId: b.damRef ? idMap.get(b.damRef) : undefined,
    sourceFile: file.filename,
    confidence: b.confidence,
    verified: false,
  }));

  const rootBirdId = idMap.get(parsed.rootLocalId);
  if (!rootBirdId) {
    throw new Error('Extraction did not identify a root bird (rootLocalId did not match any returned bird).');
  }

  return {
    sourceFile: file.filename,
    rootBirdId,
    birds,
    extractionNotes: parsed.extractionNotes || undefined,
  };
}

// ---- Phase 3: prose generation ---------------------------------------------

const LoftCredentialSchema = z.object({
  loftName: z.string(),
  claim: z.string(),
  raw: z.string(),
});

const ProseResultSchema = z.object({
  breeding: z.string(),
  lineBreedingOfNote: z.string(),
  sireOwnRecord: z.string(),
  damOwnRecord: z.string(),
  loftCredentials: z.array(LoftCredentialSchema),
});

export interface ProseInputBird {
  id: string;
  ring: string;
  name?: string;
  breeder?: string;
  notes: string[];
  notesEn?: string[];
  results: Bird['results'];
  role: string; // e.g. "child", "sire", "dam", "sire's sire", ...
}

/**
 * Phase 3 — one LLM call to write the prose sections, over the
 * already-merged, already-verified tree. `lineBreedingSummary` is computed
 * mechanically (Phase 5 logic) and handed in as grounding, not re-derived
 * by the model.
 */
export async function generateProse(
  client: Anthropic,
  model: string,
  childRing: string,
  tree: ProseInputBird[],
  lineBreedingSummary: string[],
): Promise<PedigreeProse> {
  const treeText = tree
    .map((b) => {
      const lines = [`[${b.id}] ${b.role} — ring ${b.ring}${b.name ? ` "${b.name}"` : ''}${b.breeder ? `, bred by ${b.breeder}` : ''}`];
      for (const n of b.notes) lines.push(`  note: ${n}`);
      for (const n of b.notesEn ?? []) lines.push(`  note (en): ${n}`);
      for (const r of b.results) lines.push(`  result: ${r.raw}`);
      return lines.join('\n');
    })
    .join('\n\n');

  const lineBreedingText = lineBreedingSummary.length
    ? `Line-breeding already detected mechanically in this tree:\n${lineBreedingSummary.map((s) => `- ${s}`).join('\n')}`
    : 'No repeated ancestors were detected in this tree.';

  const response = await client.messages.parse({
    model,
    max_tokens: 8000,
    system: PROSE_SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(ProseResultSchema), effort: 'high' },
    messages: [
      {
        role: 'user',
        content: `Child bird ring: ${childRing}\n\n${lineBreedingText}\n\nFull merged tree:\n\n${treeText}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Prose generation failed to parse into the expected schema.');
  }
  return parsed;
}
