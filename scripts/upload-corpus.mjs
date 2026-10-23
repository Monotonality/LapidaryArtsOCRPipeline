// Uploads the prepared study corpus images to a private Supabase Storage bucket.
//
// Usage:
//   node scripts/prepare-corpus.mjs   # writes public/corpus/R1.jpg, R2.jpg, ...
//   node scripts/upload-corpus.mjs    # uploads them to Supabase Storage
//
// Optional: set CORPUS_BUCKET to override the bucket name (default: study-corpus).
// The bucket stays private; the app serves images through /api/corpus/<label>
// after checking the signed-in user.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Missing env files are fine; variables may be set in the shell.
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.CORPUS_BUCKET ?? "study-corpus";
const force = process.argv.includes("--force");

if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}

const corpusDir = path.join(root, "public", "corpus");
const manifestPath = path.join(root, "app", "study", "corpus-manifest.json");

if (!fs.existsSync(corpusDir)) {
  console.error(
    `Corpus directory not found: ${corpusDir}\nRun: node scripts/prepare-corpus.mjs`,
  );
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: bucketError } = await supabase.storage.createBucket(bucket, {
  public: false,
});
if (bucketError && !/already exists/i.test(bucketError.message)) {
  console.error(`Could not create bucket "${bucket}": ${bucketError.message}`);
  process.exit(1);
}

let existing = new Set();
if (!force) {
  const { data: objects, error: listError } = await supabase.storage
    .from(bucket)
    .list("", { limit: 1000 });
  if (listError) {
    console.warn(`Could not list bucket contents: ${listError.message}`);
  } else {
    existing = new Set((objects ?? []).map((o) => o.name));
  }
}

const tasks = [];
for (const entry of manifest) {
  const name = `${entry.label}.jpg`;
  const src = path.join(corpusDir, name);
  if (!fs.existsSync(src)) {
    tasks.push({ label: entry.label, name, src: null });
    continue;
  }
  if (!force && existing.has(name)) {
    tasks.push({ label: entry.label, name, src: null, skipped: true });
    continue;
  }
  tasks.push({ label: entry.label, name, src });
}

let uploaded = 0;
let skipped = 0;
let failed = 0;
let next = 0;

async function worker() {
  while (next < tasks.length) {
    const task = tasks[next++];
    if (task.skipped) {
      skipped++;
      continue;
    }
    if (!task.src) {
      console.warn(`MISSING prepared image for ${task.label}: ${task.name}`);
      failed++;
      continue;
    }
    const body = fs.readFileSync(task.src);
    const { error } = await supabase.storage.from(bucket).upload(task.name, body, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) {
      console.error(`FAILED ${task.name}: ${error.message}`);
      failed++;
      continue;
    }
    uploaded++;
    if (uploaded % 25 === 0) {
      console.log(`  ...${uploaded} uploaded`);
    }
  }
}

await Promise.all(
  Array.from({ length: Math.min(6, tasks.length) }, () => worker()),
);

console.log(
  `Done. ${uploaded} uploaded, ${skipped} already present, ${failed} failed. Bucket: ${bucket}`,
);

if (failed > 0) process.exit(1);
