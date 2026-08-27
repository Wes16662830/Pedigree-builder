// Phase 3 — merge, ported for D1 (async). Same logic as server/lib/merge.ts.

import type { Bird, PedigreeSide } from '../../shared/types.js';
import { normaliseRing } from '../../shared/ring.js';
import { findLineBreeding } from '../../shared/crossref.js';
import type { ProseInputBird } from '../../shared/anthropic.js';
import { generateProse } from './anthropic.js';
import { getAllBirds, getBird, saveBird, saveChildPedigree } from '../db.js';
import type { Env } from '../env.js';

export function walkTree(rootId: string, index: Map<string, Bird>): Bird[] {
  const out: Bird[] = [];
  const seen = new Set<string>();
  function visit(id?: string) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const bird = index.get(id);
    if (!bird) return;
    out.push(bird);
    visit(bird.sireId);
    visit(bird.damId);
  }
  visit(rootId);
  return out;
}

function roleLabel(path: PedigreeSide[]): string {
  if (path.length === 0) return 'subject';
  const named = path.map((s) => (s === 'sire' ? "sire's" : "dam's"));
  if (path.length === 1) return path[0];
  return `${named.slice(0, -1).join(' ')} ${path[path.length - 1]}`;
}

// The merge routes hand `child` through from the raw request body, so
// coerce these two array fields rather than trusting their shape — a
// malformed `results` would otherwise reach the sheet renderer and the
// prose prompt as-is.
export function cleanResults(results: unknown): Bird['results'] {
  if (!Array.isArray(results)) return [];
  return results
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      race: typeof r.race === 'string' ? r.race : '',
      distanceKm: typeof r.distanceKm === 'number' ? r.distanceKm : undefined,
      year: typeof r.year === 'number' ? r.year : undefined,
      position: typeof r.position === 'number' ? r.position : undefined,
      poolSize: typeof r.poolSize === 'number' ? r.poolSize : undefined,
      federation: typeof r.federation === 'string' ? r.federation : undefined,
      raw: typeof r.raw === 'string' ? r.raw : '',
    }))
    // A row with neither a race name nor verbatim text carries nothing.
    .filter((r) => r.race.trim() || r.raw.trim());
}

export function cleanNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
}

export interface MergeInput {
  sireRootId: string;
  damRootId: string;
  child: {
    ring: string;
    name?: string;
    colour?: string;
    sex?: Bird['sex'];
    breeder?: string;
    loftAddress?: string;
    // The child's own race record / prose notes, entered by the operator on
    // the merge form. These are not just display data: they're folded into
    // the prose call's grounding below, so a child with its own results gets
    // prose that actually accounts for them rather than describing it purely
    // through its parents.
    results?: Bird['results'];
    notes?: string[];
  };
  // Present only when this side came from a fresh upload this session —
  // reusing an already-verified bird on file has no upload of its own.
  sireUploadId?: string;
  damUploadId?: string;
}

export interface MergeResult {
  child: Bird;
  childPedigreeId: string;
  tree: Bird[];
  lineBreedingSummary: string[];
}

export async function mergePedigree(env: Env, input: MergeInput): Promise<MergeResult> {
  const allBirds = await getAllBirds(env.DB);
  const index = new Map(allBirds.map((b) => [b.id, b]));

  const sireRoot = await getBird(env.DB, input.sireRootId);
  const damRoot = await getBird(env.DB, input.damRootId);
  if (!sireRoot) throw new Error(`Sire root bird ${input.sireRootId} not found`);
  if (!damRoot) throw new Error(`Dam root bird ${input.damRootId} not found`);

  const child: Bird = {
    id: crypto.randomUUID(),
    ring: input.child.ring,
    name: input.child.name,
    colour: input.child.colour,
    sex: input.child.sex ?? 'unknown',
    breeder: input.child.breeder,
    loftAddress: input.child.loftAddress,
    notes: cleanNotes(input.child.notes),
    results: cleanResults(input.child.results),
    sireId: sireRoot.id,
    damId: damRoot.id,
    confidence: 1,
    verified: true,
  };
  child.ringNormalised = normaliseRing(child.ring);

  await saveBird(env.DB, child);
  index.set(child.id, child);

  const sireTree = walkTree(sireRoot.id, index);
  const damTree = walkTree(damRoot.id, index);
  const fullTree = [child, ...sireTree, ...damTree];

  const matches = findLineBreeding(fullTree).filter((m) => m.birdId === child.id);
  const lineBreedingSummary = matches.map((m) => {
    const side = m.occurrences.map((o) => o.side.join('>')).join(' and ');
    return `${m.ancestorRing}${m.ancestorName ? ` "${m.ancestorName}"` : ''} sits ${m.notation} (generations: ${m.occurrences.map((o) => o.generation).join(', ')}; paths: ${side})`;
  });

  const roleOf = new Map<string, string>([[child.id, 'subject']]);
  function labelSide(rootId: string, firstSide: PedigreeSide) {
    function visit(id: string | undefined, path: PedigreeSide[]) {
      if (!id) return;
      const bird = index.get(id);
      if (!bird) return;
      roleOf.set(id, roleLabel(path));
      visit(bird.sireId, [...path, 'sire']);
      visit(bird.damId, [...path, 'dam']);
    }
    visit(rootId, [firstSide]);
  }
  labelSide(sireRoot.id, 'sire');
  labelSide(damRoot.id, 'dam');

  const proseInput: ProseInputBird[] = fullTree.map((b) => ({
    id: b.id,
    ring: b.ring,
    name: b.name,
    breeder: b.breeder,
    notes: b.notes,
    notesEn: b.notesEn,
    results: b.results,
    role: roleOf.get(b.id) ?? 'ancestor',
  }));

  const prose = await generateProse(env, child.ring, proseInput, lineBreedingSummary);

  const childPedigreeId = crypto.randomUUID();
  await saveChildPedigree(env.DB, {
    id: childPedigreeId,
    childBirdId: child.id,
    sireUploadId: input.sireUploadId,
    damUploadId: input.damUploadId,
    prose,
  });

  return { child, childPedigreeId, tree: fullTree, lineBreedingSummary };
}

export async function getFullTree(env: Env, childId: string): Promise<Bird[]> {
  const allBirds = await getAllBirds(env.DB);
  const index = new Map(allBirds.map((b) => [b.id, b]));
  return walkTree(childId, index);
}
