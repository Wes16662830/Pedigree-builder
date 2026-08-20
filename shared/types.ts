// Core data model. Shared verbatim between the Express backend and the React
// frontend (imported by relative path from both) so extraction, storage and
// rendering never disagree about the shape of a bird.
//
// Rules encoded here (see build brief §4):
//  - `ring` is stored exactly as written on the source pedigree. `ringNormalised`
//    is a derived matching key and must never be written back over `ring`.
//  - `notes` and `results[].raw` preserve source wording verbatim. Any
//    translation goes in a *separate* field (`notesEn`) — never in place.
//  - `sex` is 'unknown' unless the source pedigree states it outright. Never
//    inferred from V/W markers on an ancestor box.

export type Sex = 'cock' | 'hen' | 'unknown';

export interface Result {
  race: string; // "Graaff-Reinet"
  distanceKm?: number; // 390
  year?: number; // 2022
  position?: number; // 17
  poolSize?: number; // 1100
  federation?: string; // "Bloemfontein Federation"
  raw: string; // verbatim source text — always keep
}

export interface Bird {
  id: string;
  ring: string; // verbatim, e.g. "ZA 21 BPFD 845"
  ringNormalised?: string; // "ZA-2021-BPFD-845" for matching
  name?: string; // "YELLOW RING"
  colour?: string;
  sex: Sex;
  breeder?: string;
  loftAddress?: string;
  notes: string[]; // prose claims, one per paragraph, verbatim source wording
  notesEn?: string[]; // English translation of `notes`, same index alignment. Never overwrites notes.
  results: Result[];
  sireId?: string;
  damId?: string;
  sourceFile?: string; // which upload this came from
  photoUrl?: string; // /uploads/photos/... — optional, set via POST /api/birds/:id/photo
  confidence: number; // 0–1, from extraction
  verified: boolean; // human confirmed in Phase 2
  createdAt?: string;
  updatedAt?: string;
}

// A pedigree upload produces one root Bird (the parent whose sheet was
// scanned) plus its ancestor tree, flattened into a list of Birds linked by
// sireId/damId. The root is always birds[0].
export interface ExtractedPedigree {
  sourceFile: string;
  rootBirdId: string;
  birds: Bird[];
  extractionNotes?: string; // model's free-text caveats about the scan (illegible sections, etc.)
}

export type PedigreeSide = 'sire' | 'dam';

// A completed child sheet: two verified parent pedigrees merged, plus
// generated prose and loft credentials for the sheet itself.
export interface ChildPedigree {
  id: string;
  childBirdId: string;
  sireRootId: string;
  damRootId: string;
  prose: PedigreeProse;
  createdAt: string;
  updatedAt: string;
}

export interface LoftCredential {
  loftName: string;
  claim: string; // e.g. "1st Nat. General Champion CZ six times" — describes the loft, not a bird
  raw: string;
  sourceBirdId?: string; // which ancestor's sheet this credential came from
}

export interface PedigreeProse {
  breeding: string;
  lineBreedingOfNote: string;
  sireOwnRecord: string;
  damOwnRecord: string;
  loftCredentials: LoftCredential[];
}

// Phase 5 — cross-reference results.
export interface SharedAncestorMatch {
  ancestorId: string;
  ancestorRing: string;
  ancestorName?: string;
  foundIn: { birdId: string; birdRing: string; sourceFile?: string }[];
}

export interface LineBreedingMatch {
  birdId: string; // the bird whose pedigree this line-breeding appears in
  ancestorId: string;
  ancestorRing: string;
  ancestorName?: string;
  occurrences: { generation: number; side: PedigreeSide[] }[]; // path of sire/dam choices to reach the ancestor
  notation: string; // e.g. "4x5"
}

export interface SiblingMatch {
  birdAId: string;
  birdBId: string;
  sireId: string;
  damId: string;
  relationship: 'full-sibling' | 'half-sibling';
}

export interface CrossReferenceReport {
  sharedAncestors: SharedAncestorMatch[];
  lineBreeding: LineBreedingMatch[];
  siblings: SiblingMatch[];
}

export interface InbreedingResult {
  birdId: string;
  coefficient: number; // Wright's coefficient of inbreeding, 0–1
  contributingAncestors: { ancestorId: string; ancestorRing: string; contribution: number }[];
}

// Confidence below this threshold is flagged amber in the verification UI.
export const CONFIDENCE_FLAG_THRESHOLD = 0.85;
