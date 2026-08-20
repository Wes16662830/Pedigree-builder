// Batch mode (build brief §6 step 7): a folder of pedigrees in, a folder of
// sheets out. This still runs every upload through Phase 1 extraction, but
// deliberately stops short of Phase 4 render — per §8 ("do not render a
// sheet that has not passed the verification step") nothing here writes a
// certificate. It extracts every file it finds and reports what needs a
// human before anything can be merged or rendered.
//
// Usage:
//   npm run batch -- <input-dir> [output-dir]
//
// Input directory convention: pair files by a shared prefix ending in
// "-sire" / "-dam", e.g.
//   ZA2805-sire.png  ZA2805-dam.png
//   ZA2818-sire.pdf  ZA2818-dam.jpg
// Unpaired files are still extracted and reported, just not paired for a
// merge suggestion.

import fs from 'node:fs';
import path from 'node:path';
import { extractPedigree } from '../lib/anthropic.js';
import { saveBirds, saveUpload } from '../db.js';
import { randomUUID } from 'node:crypto';

const ACCEPTED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf']);
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

async function main() {
  const [, , inputDirArg, outputDirArg] = process.argv;
  if (!inputDirArg) {
    console.error('Usage: npm run batch -- <input-dir> [output-dir]');
    process.exit(1);
  }
  const inputDir = path.resolve(inputDirArg);
  const outputDir = path.resolve(outputDirArg ?? path.join(inputDir, 'out'));
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(inputDir).filter((f) => ACCEPTED_EXT.has(path.extname(f).toLowerCase()));
  if (files.length === 0) {
    console.log(`No supported files (${[...ACCEPTED_EXT].join(', ')}) found in ${inputDir}`);
    return;
  }

  console.log(`Found ${files.length} file(s). One extraction call each.\n`);

  const summary: { file: string; ok: boolean; birdCount?: number; lowConfidenceCount?: number; error?: string }[] = [];

  for (const file of files) {
    const fullPath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();
    process.stdout.write(`Extracting ${file} ... `);
    try {
      const base64 = fs.readFileSync(fullPath).toString('base64');
      const extracted = await extractPedigree({ filename: file, mimeType: MIME_BY_EXT[ext], base64 });

      const uploadId = randomUUID();
      saveUpload({
        id: uploadId,
        originalFilename: file,
        storedPath: fullPath,
        mimeType: MIME_BY_EXT[ext],
        rootBirdId: extracted.rootBirdId,
        rawExtraction: extracted,
        verified: false,
      });
      saveBirds(extracted.birds);

      const lowConfidence = extracted.birds.filter((b) => b.confidence < 0.85);
      console.log(`${extracted.birds.length} birds (${lowConfidence.length} flagged for review)`);

      const outFile = path.join(outputDir, `${path.basename(file, ext)}.json`);
      fs.writeFileSync(outFile, JSON.stringify({ uploadId, extracted }, null, 2), 'utf-8');

      summary.push({ file, ok: true, birdCount: extracted.birds.length, lowConfidenceCount: lowConfidence.length });
    } catch (err) {
      console.log('FAILED');
      summary.push({ file, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const reportPath = path.join(outputDir, 'batch-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log(`\nDone. ${summary.filter((s) => s.ok).length}/${summary.length} extracted successfully.`);
  console.log(`Extraction JSON + report written to ${outputDir}`);
  console.log(`\nNothing here is verified or rendered — open the app, run Phase 2 verification on each upload,`);
  console.log(`then merge and render the ones you want as certificates. Batch mode only removes the`);
  console.log(`one-file-at-a-time drudgery of Phase 1.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
