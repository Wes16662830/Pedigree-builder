// Wright's coefficient of inbreeding, computed from the merged tree
// (build brief §5 Phase 5). Pure graph logic — no I/O — so it is shared
// between the server (which runs it after a merge) and any UI that wants to
// recompute against edited data.
//
// Ancestor identity for this calculation is `ringNormalised`, not the row
// id. The sire's pedigree and the dam's pedigree are extracted independently
// (two separate uploads, two separate API calls) — a physical ancestor
// common to both sides gets a different row id in each tree, and matching
// by id would silently miss every real case of inbreeding this tool exists
// to catch. Two rows with the same ringNormalised are treated as the same
// ancestor; a bird with no ring on record falls back to its own id (so it
// only ever matches itself).

import type { Bird } from './types';

interface AncestorEdge {
  id: string;
  ringNormalised?: string;
  sireId?: string;
  damId?: string;
}

type PedigreeIndex = Map<string, AncestorEdge>; // keyed by row id

function buildIndex(birds: Bird[]): PedigreeIndex {
  const idx: PedigreeIndex = new Map();
  for (const b of birds) idx.set(b.id, { id: b.id, ringNormalised: b.ringNormalised, sireId: b.sireId, damId: b.damId });
  return idx;
}

function identityKey(node: AncestorEdge): string {
  return node.ringNormalised ? `ring:${node.ringNormalised}` : `id:${node.id}`;
}

/**
 * From `startId`, walk all ancestors reachable via sire/dam edges and
 * return a map from ancestor identity key to the list of generation depths
 * at which that identity was reached (depth 1 = startId's own parents).
 */
function ancestorPaths(startId: string, idx: PedigreeIndex, maxDepth = 12): Map<string, number[]> {
  const result = new Map<string, number[]>();
  function walk(id: string, depth: number, seenIds: Set<string>) {
    if (depth > maxDepth) return;
    const node = idx.get(id);
    if (!node) return;
    for (const parentId of [node.sireId, node.damId]) {
      if (!parentId || seenIds.has(parentId)) continue;
      const parentNode = idx.get(parentId);
      if (!parentNode) continue;
      const key = identityKey(parentNode);
      const list = result.get(key) ?? [];
      list.push(depth);
      result.set(key, list);
      walk(parentId, depth + 1, new Set(seenIds).add(parentId));
    }
  }
  walk(startId, 1, new Set([startId]));
  return result;
}

function representativeIds(birds: Bird[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of birds) {
    const key = b.ringNormalised ? `ring:${b.ringNormalised}` : `id:${b.id}`;
    if (!map.has(key)) map.set(key, b.id);
  }
  return map;
}

/**
 * Wright's coefficient of inbreeding for `birdId`:
 *   F = sum over each common ancestor A of sire and dam of (1/2)^(n1+n2+1) * (1 + F_A)
 * where n1, n2 are the number of generations from sire and dam to A
 * respectively. F_A (the common ancestor's own inbreeding coefficient) is
 * included when it can be computed from the same tree; otherwise treated as
 * 0, which is the standard simplification when an ancestor's own parents
 * aren't in the data.
 */
export function coefficientOfInbreeding(birdId: string, birds: Bird[]): { coefficient: number; contributingAncestors: { ancestorId: string; contribution: number }[] } {
  const idx = buildIndex(birds);
  const self = idx.get(birdId);
  if (!self || !self.sireId || !self.damId) {
    return { coefficient: 0, contributingAncestors: [] };
  }
  const sireNode = idx.get(self.sireId);
  const damNode = idx.get(self.damId);
  if (!sireNode || !damNode) {
    return { coefficient: 0, contributingAncestors: [] };
  }

  const sireAll = ancestorPaths(self.sireId, idx);
  sireAll.set(identityKey(sireNode), [...(sireAll.get(identityKey(sireNode)) ?? []), 0]);

  const damAll = ancestorPaths(self.damId, idx);
  damAll.set(identityKey(damNode), [...(damAll.get(identityKey(damNode)) ?? []), 0]);

  const common = [...sireAll.keys()].filter((key) => damAll.has(key));

  const repIds = representativeIds(birds);
  const contributions: { ancestorId: string; contribution: number }[] = [];
  let total = 0;

  const inbreedingCache = new Map<string, number>();
  function fOf(key: string): number {
    if (inbreedingCache.has(key)) return inbreedingCache.get(key)!;
    inbreedingCache.set(key, 0); // guard recursion on bad/cyclic data
    const repId = repIds.get(key);
    const node = repId ? idx.get(repId) : undefined;
    let f = 0;
    if (repId && node?.sireId && node?.damId) {
      f = coefficientOfInbreeding(repId, birds).coefficient;
    }
    inbreedingCache.set(key, f);
    return f;
  }

  for (const key of common) {
    const n1s = sireAll.get(key)!;
    const n2s = damAll.get(key)!;
    const fA = fOf(key);
    let ancestorContribution = 0;
    for (const n1 of n1s) {
      for (const n2 of n2s) {
        ancestorContribution += Math.pow(0.5, n1 + n2 + 1) * (1 + fA);
      }
    }
    total += ancestorContribution;
    contributions.push({ ancestorId: repIds.get(key) ?? key, contribution: ancestorContribution });
  }

  contributions.sort((a, b) => b.contribution - a.contribution);
  return { coefficient: total, contributingAncestors: contributions };
}
