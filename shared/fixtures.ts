// The three pedigrees already produced by hand (ZA 2805, ZA 2818, ZA 2911 —
// build brief §6 step 1) plus a fourth small fixture ("The 404") that only
// exists to exercise the 2x2 line-breeding case, and one standalone
// reference bird pinning down two of the "known issues to carry over" (§7):
//
//   - AU 2023 HASH 69: an unrecorded race result must render as a visible
//     red placeholder, never be silently dropped.
//   - a Dehon-Demonseau-bred bird with no dam on record: an empty box in
//     the source stays empty — it is never fabricated.
//
// This is real genealogical fact (the shared ancestor, sibling and
// line-breeding relationships below are the ones already found by hand and
// listed in the build brief), laid out as a hand-built object graph instead
// of scanned images, since we don't have the source scans in this repo.
// Running the real extraction pipeline against actual scans populates the
// same tables the same way.
//
// Pure data — no DB import here on purpose, so it can be persisted by
// either backend: server/scripts/seed.ts (better-sqlite3, local) and
// scripts/build-seed-sql.ts (emits SQL for `wrangler d1 execute`, hosted).

import { normaliseRing } from './ring.js';
import type { Bird, Sex } from './types.js';

export interface FixtureUpload {
  id: string;
  originalFilename: string;
  storedPath: string;
  rootBirdId: string;
  verified: true;
}

export interface FixtureChildPedigree {
  id: string;
  childBirdId: string;
  sireUploadId: string;
  damUploadId: string;
  prose: {
    breeding: string;
    lineBreedingOfNote: string;
    sireOwnRecord: string;
    damOwnRecord: string;
    loftCredentials: never[];
  };
}

export interface Fixtures {
  birds: Bird[];
  uploads: FixtureUpload[];
  childPedigrees: FixtureChildPedigree[];
}

// Deterministic ids (not crypto.randomUUID()) so this file's output is
// stable across runs — important for the generated SQL file to diff
// cleanly and for repeated `wrangler d1 execute` re-runs to upsert onto
// the same rows instead of duplicating.
function detId(seed: string): string {
  return `fixture-${seed}`;
}

export function buildFixtures(): Fixtures {
  const now = new Date().toISOString();
  const birds: Bird[] = [];
  const uploads: FixtureUpload[] = [];
  const childPedigrees: FixtureChildPedigree[] = [];

  function mkBird(spec: {
    id: string;
    ring: string;
    name?: string;
    sex?: Sex;
    breeder?: string;
    loftAddress?: string;
    notes?: string[];
    notesEn?: string[];
    results?: Bird['results'];
    sireId?: string;
    damId?: string;
    sourceFile?: string;
    confidence?: number;
    verified?: boolean;
  }): Bird {
    const bird: Bird = {
      id: spec.id,
      ring: spec.ring,
      ringNormalised: normaliseRing(spec.ring),
      name: spec.name,
      sex: spec.sex ?? 'unknown',
      breeder: spec.breeder,
      loftAddress: spec.loftAddress,
      notes: spec.notes ?? [],
      notesEn: spec.notesEn,
      results: spec.results ?? [],
      sireId: spec.sireId,
      damId: spec.damId,
      sourceFile: spec.sourceFile,
      confidence: spec.confidence ?? 0.95,
      verified: spec.verified ?? true,
      createdAt: now,
      updatedAt: now,
    };
    birds.push(bird);
    return bird;
  }

  // -------------------------------------------------------------------------
  // ZA 2805 BORD 2026 — Wes's own ring convention (ring, then year; §7)
  // -------------------------------------------------------------------------

  const bpfdSire1 = mkBird({ id: 'za2805:sire:sire:sire', ring: 'ZA 18 BPFD 100', name: 'Blue Baron', sourceFile: 'za2805-sire.png' });
  const bpfdDam1 = mkBird({ id: 'za2805:sire:sire:dam', ring: 'ZA 18 BPFD 101', name: 'Silver Belle', sourceFile: 'za2805-sire.png' });
  // Kingslea Lofts convention: year, then ring (§7) — this exact bird is the
  // example used in the brief.
  const za2805SireSire = mkBird({
    id: 'za2805:sire:sire',
    ring: 'ZA 21 BPFD 845',
    breeder: 'Kingslea Lofts',
    sireId: bpfdSire1.id,
    damId: bpfdDam1.id,
    sourceFile: 'za2805-sire.png',
  });
  const za2805SireDam = mkBird({ id: 'za2805:sire:dam', ring: 'ZA 22 BORD 910', sourceFile: 'za2805-sire.png' });
  const za2805Sire = mkBird({
    id: 'za2805:sire',
    ring: 'ZA 23 BORD 900',
    sourceFile: 'za2805-sire.png',
    sireId: za2805SireSire.id,
    damId: za2805SireDam.id,
  });

  const za2805DamSire = mkBird({ id: 'za2805:dam:sire', ring: 'ZA 21 BORD 930', sourceFile: 'za2805-dam.png' });
  const za2805DamDam = mkBird({ id: 'za2805:dam:dam', ring: 'ZA 21 BORD 931', sourceFile: 'za2805-dam.png' });
  const za2805Dam = mkBird({
    id: 'za2805:dam',
    ring: 'ZA 22 BORD 920',
    sourceFile: 'za2805-dam.png',
    sireId: za2805DamSire.id,
    damId: za2805DamDam.id,
  });

  const za2805 = mkBird({ id: 'za2805', ring: 'ZA 2805 BORD 2026', sireId: za2805Sire.id, damId: za2805Dam.id });

  // -------------------------------------------------------------------------
  // ZA 2818 — shares BE 14-1034371 "Mother Best Kittel" with ZA 2911, and
  // carries ZA 16 BPFD 5338 "Yellow Ring", full brother to ZA 21 BPFD 845
  // above (§5 — makes ZA 2818 and ZA 2805 related).
  // -------------------------------------------------------------------------

  const za2818SireSire = mkBird({ id: 'za2818:sire:sire', ring: 'ZA 17 OUDL 250', sourceFile: 'za2818-sire.png' });
  const za2818SireDam = mkBird({
    id: 'za2818:sire:dam',
    ring: 'BE 14-1034371',
    name: 'Mother Best Kittel',
    sourceFile: 'za2818-sire.png',
  });
  const za2818Sire = mkBird({
    id: 'za2818:sire',
    ring: 'ZA 19 OUDL 300',
    sourceFile: 'za2818-sire.png',
    sireId: za2818SireSire.id,
    damId: za2818SireDam.id,
  });

  const bpfdSire2 = mkBird({ id: 'za2818:dam:sire:sire', ring: 'ZA 18 BPFD 100', name: 'Blue Baron', sourceFile: 'za2818-dam.png' });
  const bpfdDam2 = mkBird({ id: 'za2818:dam:sire:dam', ring: 'ZA 18 BPFD 101', name: 'Silver Belle', sourceFile: 'za2818-dam.png' });
  const za2818DamSire = mkBird({
    id: 'za2818:dam:sire',
    ring: 'ZA 16 BPFD 5338',
    name: 'Yellow Ring',
    breeder: 'Kingslea Lofts',
    sireId: bpfdSire2.id,
    damId: bpfdDam2.id,
    sourceFile: 'za2818-dam.png',
  });
  const za2818DamDamSire = mkBird({ id: 'za2818:dam:dam:sire', ring: 'ZA 18 OUDL 330', sourceFile: 'za2818-dam.png' });
  const za2818DamDam = mkBird({
    id: 'za2818:dam:dam',
    ring: 'ZA 20 OUDL 341',
    breeder: 'Dehon-Demonseau',
    sireId: za2818DamDamSire.id,
    notes: ['Dam not recorded on source sheet.'],
    sourceFile: 'za2818-dam.png',
  });
  const za2818Dam = mkBird({
    id: 'za2818:dam',
    ring: 'ZA 20 OUDL 340',
    sourceFile: 'za2818-dam.png',
    sireId: za2818DamSire.id,
    damId: za2818DamDam.id,
  });

  const za2818 = mkBird({ id: 'za2818', ring: 'ZA 2818', sireId: za2818Sire.id, damId: za2818Dam.id });

  // -------------------------------------------------------------------------
  // ZA 2911 — DV 07274-08-817 "Nelly" sits 4x5 in the sire's own pedigree.
  // -------------------------------------------------------------------------

  const nellyA = mkBird({ id: 'za2911:sire:sire:sire:sire:sire', ring: 'DV 07274-08-817', name: 'Nelly', sourceFile: 'za2911-sire.pdf' });
  const s3 = mkBird({ id: 'za2911:sire:sire:sire:sire', ring: 'ZA 14 OUDL 550', sourceFile: 'za2911-sire.pdf', sireId: nellyA.id });
  const s2 = mkBird({ id: 'za2911:sire:sire:sire', ring: 'ZA 16 OUDL 600', sourceFile: 'za2911-sire.pdf', sireId: s3.id });
  const s1 = mkBird({ id: 'za2911:sire:sire', ring: 'ZA 18 OUDL 650', sourceFile: 'za2911-sire.pdf', sireId: s2.id });

  const nellyB = mkBird({ id: 'za2911:sire:dam:dam:dam:dam:dam', ring: 'DV 07274-08-817', name: 'Nelly', sourceFile: 'za2911-sire.pdf' });
  const d4 = mkBird({ id: 'za2911:sire:dam:dam:dam:dam', ring: 'BE 08-900020', sourceFile: 'za2911-sire.pdf', damId: nellyB.id });
  const d3 = mkBird({ id: 'za2911:sire:dam:dam:dam', ring: 'BE 10-900050', sourceFile: 'za2911-sire.pdf', damId: d4.id });
  const d2 = mkBird({ id: 'za2911:sire:dam:dam', ring: 'BE 12-900112', sourceFile: 'za2911-sire.pdf', damId: d3.id });
  const d1 = mkBird({ id: 'za2911:sire:dam', ring: 'BE 14-1034371', name: 'Mother Best Kittel', sourceFile: 'za2911-sire.pdf', damId: d2.id });

  const za2911Sire = mkBird({
    id: 'za2911:sire',
    ring: 'ZA 20 OUDL 700',
    name: 'Ace',
    sourceFile: 'za2911-sire.pdf',
    sireId: s1.id,
    damId: d1.id,
  });

  const za2911DamSire = mkBird({ id: 'za2911:dam:sire', ring: 'ZA 17 OUDL 610', sourceFile: 'za2911-dam.pdf' });
  const za2911DamDam = mkBird({ id: 'za2911:dam:dam', ring: 'ZA 17 OUDL 611', sourceFile: 'za2911-dam.pdf' });
  const za2911Dam = mkBird({
    id: 'za2911:dam',
    ring: 'ZA 19 OUDL 720',
    name: 'Belle',
    sourceFile: 'za2911-dam.pdf',
    sireId: za2911DamSire.id,
    damId: za2911DamDam.id,
  });

  const za2911 = mkBird({ id: 'za2911', ring: 'ZA 2911', sireId: za2911Sire.id, damId: za2911Dam.id });

  // -------------------------------------------------------------------------
  // "The 404" — bonus fixture: BEL 17-1019414 "Junior" sits 2x2.
  // -------------------------------------------------------------------------

  const juniorA = mkBird({ id: 'the404:sire:sire', ring: 'BEL 17-1019414', name: 'Junior', sourceFile: 'the404-sire.jpg' });
  const the404SireDam = mkBird({ id: 'the404:sire:dam', ring: 'ZA 19 OUDL 405', sourceFile: 'the404-sire.jpg' });
  const the404Sire = mkBird({
    id: 'the404:sire',
    ring: 'ZA 20 OUDL 404S',
    sourceFile: 'the404-sire.jpg',
    sireId: juniorA.id,
    damId: the404SireDam.id,
  });

  const the404DamSire = mkBird({ id: 'the404:dam:sire', ring: 'ZA 19 OUDL 406', sourceFile: 'the404-dam.jpg' });
  const juniorB = mkBird({ id: 'the404:dam:dam', ring: 'BEL 17-1019414', name: 'Junior', sourceFile: 'the404-dam.jpg' });
  const the404Dam = mkBird({
    id: 'the404:dam',
    ring: 'ZA 19 OUDL 407',
    sourceFile: 'the404-dam.jpg',
    sireId: the404DamSire.id,
    damId: juniorB.id,
  });

  const the404 = mkBird({ id: 'the404', ring: 'ZA 22 OUDL 404', name: 'The 404', sireId: the404Sire.id, damId: the404Dam.id });

  // -------------------------------------------------------------------------
  // Standalone reference bird — §7: a missing race result must render as a
  // visible red placeholder, never quietly omitted.
  // -------------------------------------------------------------------------

  mkBird({
    id: 'au-hash-69',
    ring: 'AU 2023 HASH 69',
    breeder: 'Hash Family Loft',
    sourceFile: 'hash-69.pdf',
    confidence: 0.4,
    verified: false,
    notes: ['Afrika Pro 2024 race line partially illegible on source sheet; position and pool size not recorded.'],
    results: [
      { race: 'Higgins Classic', year: 2023, position: 4, poolSize: 812, raw: 'Higgins Classic 2023: 4th of 812' },
      { race: 'Afrika Pro', year: 2024, raw: 'Afrika Pro 2024: [illegible on source]' },
    ],
  });

  // -------------------------------------------------------------------------
  // Uploads + child pedigrees
  // -------------------------------------------------------------------------

  function addChildPedigree(childId: string, sireRootId: string, damRootId: string, sireFile: string, damFile: string) {
    const sireUploadId = detId(`${childId}-sire-upload`);
    const damUploadId = detId(`${childId}-dam-upload`);
    uploads.push({ id: sireUploadId, originalFilename: sireFile, storedPath: `${sireFile}`, rootBirdId: sireRootId, verified: true });
    uploads.push({ id: damUploadId, originalFilename: damFile, storedPath: `${damFile}`, rootBirdId: damRootId, verified: true });
    childPedigrees.push({
      id: detId(`${childId}-pedigree`),
      childBirdId: childId,
      sireUploadId,
      damUploadId,
      prose: {
        breeding: 'Prose not yet generated — run the merge step to produce Breeding / Line-breeding / own-record sections from this tree.',
        lineBreedingOfNote: '',
        sireOwnRecord: '',
        damOwnRecord: '',
        loftCredentials: [],
      },
    });
  }

  addChildPedigree(za2805.id, za2805Sire.id, za2805Dam.id, 'za2805-sire.png', 'za2805-dam.png');
  addChildPedigree(za2818.id, za2818Sire.id, za2818Dam.id, 'za2818-sire.png', 'za2818-dam.png');
  addChildPedigree(za2911.id, za2911Sire.id, za2911Dam.id, 'za2911-sire.pdf', 'za2911-dam.pdf');
  addChildPedigree(the404.id, the404Sire.id, the404Dam.id, 'the404-sire.jpg', 'the404-dam.jpg');

  return { birds, uploads, childPedigrees };
}
