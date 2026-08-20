// Seeds birds.db with the fixtures in shared/fixtures.ts (see that file for
// what they are and why). Run: npm run db:seed
//
// For the hosted (Cloudflare) target, see scripts/build-seed-sql.ts, which
// emits the same fixtures as SQL for `wrangler d1 execute`.

import { saveBirds, saveUpload, saveChildPedigree, db } from '../db.js';
import { buildFixtures } from '../../shared/fixtures.js';

const { birds, uploads, childPedigrees } = buildFixtures();

saveBirds(birds);
for (const u of uploads) {
  saveUpload({ id: u.id, originalFilename: u.originalFilename, storedPath: `data/uploads/${u.storedPath}`, rootBirdId: u.rootBirdId, verified: true });
}
for (const cp of childPedigrees) {
  saveChildPedigree(cp);
}

console.log(`Seeded ${birds.length} birds, ${childPedigrees.length} child pedigrees, ${uploads.length} uploads.`);
console.log(`Database: ${db.name}`);
