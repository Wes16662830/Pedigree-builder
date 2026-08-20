// Phase 3 — merge (build brief §5). Mechanical tree assembly is pure logic;
// the only LLM call in this phase writes prose over the assembled,
// already-verified tree.

import { randomUUID } from 'node:crypto';
import type { Bird, PedigreeSide } from '../../shared/types.js';
import { normaliseRing } from '../../shared/ring.js';
import { findLineBreeding } from './crossref.js';
import { generateProse, type ProseInputBird } from './anthropic.js';
import { getAllBirds, getBird, saveBird, saveChildPedigree } from '../db.js';

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
  // "sire" / "dam" for depth 1, then "sire's sire", "sire's sire's dam", ...
  if (path.length === 1) return path[0];
  return `${named.slice(0, -1).join(' ')} ${path[path.length - 1]}`;
}

export interface MergeInput {
  sireRootId: string;
  damRootId: string;
  child: {
    ring: string;
    ringNormalised?: string;
    name?: string;
    colour?: string;
    sex?: Bird['sex'];
    breeder?: string;
    loftAddress?: string;
  };
  sireUploadId: string;
  damUploadId: string;
}

export interface MergeResult {
  child: Bird;
  childPedigreeId: string;
  tree: Bird[];
  lineBreedingSummary: string[];
}

export async function mergePedigree(input: MergeInput): Promise<MergeResult> {
  const allBirds = getAllBirds();
  const index = new Map(allBirds.map((b) => [b.id, b]));

  const sireRoot = getBird(input.sireRootId);
  const damRoot = getBird(input.damRootId);
  if (!sireRoot) throw new Error(`Sire root bird ${input.sireRootId} not found`);
  if (!damRoot) throw new Error(`Dam root bird ${input.damRootId} not found`);

  const child: Bird = {
    id: randomUUID(),
    ring: input.child.ring,
    name: input.child.name,
    colour: input.child.colour,
    sex: input.child.sex ?? 'unknown',
    breeder: input.child.breeder,
    loftAddress: input.child.loftAddress,
    notes: [],
    results: [],
    sireId: sireRoot.id,
    damId: damRoot.id,
    confidence: 1,
    verified: true, // hand-entered by the operator at merge time, not extracted
  };
  child.ringNormalised = normaliseRing(child.ring);

  saveBird(child);
  index.set(child.id, child);

  const sireTree = walkTree(sireRoot.id, index);
  const damTree = walkTree(damRoot.id, index);
  const fullTree = [child, ...sireTree, ...damTree];

  // Line-breeding of note, scoped to the child we just created (Phase 5
  // logic reused here purely as grounding for the prose call — the
  // authoritative cross-collection report is still GET /api/crossref).
  const matches = findLineBreeding(fullTree).filter((m) => m.birdId === child.id);
  const lineBreedingSummary = matches.map((m) => {
    const side = m.occurrences.map((o) => o.side.join('>')).join(' and ');
    return `${m.ancestorRing}${m.ancestorName ? ` "${m.ancestorName}"` : ''} sits ${m.notation} (generations: ${m.occurrences.map((o) => o.generation).join(', ')}; paths: ${side})`;
  });

  // Role labels for the prose call, computed via a fresh BFS so both sides
  // are labelled relative to the child ("sire", "sire's sire", "dam's dam", ...).
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

  const prose = await generateProse(child.ring, proseInput, lineBreedingSummary);

  const childPedigreeId = randomUUID();
  saveChildPedigree({
    id: childPedigreeId,
    childBirdId: child.id,
    sireUploadId: input.sireUploadId,
    damUploadId: input.damUploadId,
    prose,
  });

  return { child, childPedigreeId, tree: fullTree, lineBreedingSummary };
}

/** Full tree for an already-merged child (used to re-render its sheet). */
export function getFullTree(childId: string): Bird[] {
  const allBirds = getAllBirds();
  const index = new Map(allBirds.map((b) => [b.id, b]));
  return walkTree(childId, index);
}
