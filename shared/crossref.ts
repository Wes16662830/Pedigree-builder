// Phase 5 — the actual differentiator (build brief §5). Every ancestor from
// every upload lives in one `birds` table; these functions match across the
// whole collection by `ringNormalised` (never by raw row id, since two
// different uploads produce two different rows for what is physically the
// same bird — see server/scripts/seed.ts for a worked example).

import type { Bird, CrossReferenceReport, LineBreedingMatch, PedigreeSide, SharedAncestorMatch, SiblingMatch } from './types.js';
import { coefficientOfInbreeding } from './inbreeding.js';

function byId(birds: Bird[]): Map<string, Bird> {
  return new Map(birds.map((b) => [b.id, b]));
}

/**
 * Shared ancestors: any ringNormalised that appears on birds from more than
 * one source file (i.e. more than one upload's tree). Two rows with the
 * same ring from the *same* upload aren't a "shared ancestor" finding —
 * that's just one ancestor referenced from two spots in one tree (handled
 * separately, see findLineBreeding).
 */
export function findSharedAncestors(allBirds: Bird[]): SharedAncestorMatch[] {
  const groups = new Map<string, Bird[]>();
  for (const b of allBirds) {
    if (!b.ringNormalised) continue;
    const list = groups.get(b.ringNormalised) ?? [];
    list.push(b);
    groups.set(b.ringNormalised, list);
  }

  const matches: SharedAncestorMatch[] = [];
  for (const [ringNormalised, birds] of groups) {
    const distinctSources = new Set(birds.map((b) => b.sourceFile).filter(Boolean));
    if (distinctSources.size < 2) continue;
    const first = birds[0];
    matches.push({
      ancestorId: ringNormalised,
      ancestorRing: first.ring,
      ancestorName: first.name,
      foundIn: birds.map((b) => ({ birdId: b.id, birdRing: b.ring, sourceFile: b.sourceFile })),
    });
  }
  return matches.sort((a, b) => b.foundIn.length - a.foundIn.length);
}

/**
 * Line-breeding within one pedigree: walk every bird's own ancestor tree and
 * find any ringNormalised that recurs at more than one position. Reports
 * the generation of each occurrence and a conventional "GxG" notation.
 */
export function findLineBreeding(allBirds: Bird[]): LineBreedingMatch[] {
  const idx = byId(allBirds);
  const matches: LineBreedingMatch[] = [];

  for (const subject of allBirds) {
    if (!subject.sireId && !subject.damId) continue; // no tree to walk

    const occurrences = new Map<string, { generation: number; side: PedigreeSide[] }[]>();

    function walk(id: string | undefined, generation: number, path: PedigreeSide[]) {
      if (!id || generation > 10) return;
      const bird = idx.get(id);
      if (!bird) return;
      if (bird.ringNormalised) {
        const list = occurrences.get(bird.ringNormalised) ?? [];
        list.push({ generation, side: path });
        occurrences.set(bird.ringNormalised, list);
      }
      walk(bird.sireId, generation + 1, [...path, 'sire']);
      walk(bird.damId, generation + 1, [...path, 'dam']);
    }
    walk(subject.sireId, 1, ['sire']);
    walk(subject.damId, 1, ['dam']);

    for (const [ringNormalised, occs] of occurrences) {
      if (occs.length < 2) continue;
      const sample = allBirds.find((b) => b.ringNormalised === ringNormalised);
      const gens = occs.map((o) => o.generation).sort((a, b) => a - b);
      matches.push({
        birdId: subject.id,
        ancestorId: ringNormalised,
        ancestorRing: sample?.ring ?? ringNormalised,
        ancestorName: sample?.name,
        occurrences: occs,
        notation: gens.join('x'),
      });
    }
  }

  return matches;
}

/**
 * Siblings across sheets: any two distinct birds whose sire AND/OR dam
 * resolve to the same ringNormalised. Matched by ring, not id, for the same
 * cross-upload reason as findSharedAncestors.
 */
export function findSiblings(allBirds: Bird[]): SiblingMatch[] {
  const idx = byId(allBirds);
  const ringOf = (id?: string) => (id ? idx.get(id)?.ringNormalised : undefined);

  const matches: SiblingMatch[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < allBirds.length; i++) {
    for (let j = i + 1; j < allBirds.length; j++) {
      const a = allBirds[i];
      const b = allBirds[j];
      if (a.id === b.id) continue;
      if (a.ringNormalised && a.ringNormalised === b.ringNormalised) continue; // same physical bird, not a sibling of itself

      const aSire = ringOf(a.sireId);
      const aDam = ringOf(a.damId);
      const bSire = ringOf(b.sireId);
      const bDam = ringOf(b.damId);

      const sireMatch = !!aSire && aSire === bSire;
      const damMatch = !!aDam && aDam === bDam;
      if (!sireMatch && !damMatch) continue;

      const pairKey = [a.id, b.id].sort().join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      matches.push({
        birdAId: a.id,
        birdBId: b.id,
        sireId: a.sireId ?? '',
        damId: a.damId ?? '',
        relationship: sireMatch && damMatch ? 'full-sibling' : 'half-sibling',
      });
    }
  }
  return matches;
}

export function buildCrossReferenceReport(allBirds: Bird[]): CrossReferenceReport {
  return {
    sharedAncestors: findSharedAncestors(allBirds),
    lineBreeding: findLineBreeding(allBirds),
    siblings: findSiblings(allBirds),
  };
}

export function inbreedingForBird(birdId: string, allBirds: Bird[]) {
  const { coefficient, contributingAncestors } = coefficientOfInbreeding(birdId, allBirds);
  const idx = byId(allBirds);
  return {
    birdId,
    coefficient,
    contributingAncestors: contributingAncestors.map((c) => ({
      ancestorId: c.ancestorId,
      ancestorRing: idx.get(c.ancestorId)?.ring ?? c.ancestorId,
      contribution: c.contribution,
    })),
  };
}
