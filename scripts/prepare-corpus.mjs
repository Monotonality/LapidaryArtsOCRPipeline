// Prepares the study corpus photos for the browser.
//
// Usage:
//   npm install --save-dev sharp
//   node scripts/prepare-corpus.mjs
//
// Reads 258JpgCorpus/ (see app/study/corpus-manifest.json for the R-label
// mapping), writes public/corpus/R1.jpg, R2.jpg, ... resized to max width
// 1600px. public/corpus is gitignored; re-run any time the corpus changes.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const corpusDir = path.join(root, "258JpgCorpus");
const outDir = path.join(root, "public", "corpus");
const manifestPath = path.join(root, "app", "study", "corpus-manifest.json");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "sharp is required. Install it first:\n" + "  npm install --save-dev sharp",
  );
  process.exit(1);
}

if (!fs.existsSync(corpusDir)) {
  console.error(`Corpus directory not found: ${corpusDir}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

let converted = 0;
let skipped = 0;
let failed = 0;

for (const entry of manifest) {
  const src = path.join(corpusDir, entry.file);
  const dest = path.join(outDir, `${entry.label}.jpg`);

  if (!fs.existsSync(src)) {
    console.warn(`MISSING source for ${entry.label}: ${entry.file}`);
    failed++;
    continue;
  }

  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }

  try {
    await sharp(src)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(dest);
    converted++;
    if (converted % 25 === 0) {
      console.log(`  ...${converted} converted`);
    }
  } catch (err) {
    console.error(`FAILED ${entry.label} (${entry.file}): ${err.message}`);
    failed++;
  }
}

console.log(
  `Done. ${converted} converted, ${skipped} already present, ${failed} failed. Output: public/corpus/`,
);
