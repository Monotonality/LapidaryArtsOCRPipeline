import manifest from "./corpus-manifest.json";

export type CorpusItem = {
  label: string;
  file: string;
  img: number | null;
};

export const CORPUS: CorpusItem[] = manifest;

export const CORPUS_SIZE = CORPUS.length;

export function corpusIndex(label: string): number {
  return CORPUS.findIndex((c) => c.label === label);
}

export function corpusItem(label: string): CorpusItem | null {
  const i = corpusIndex(label);
  return i === -1 ? null : CORPUS[i];
}

export function isValidLabel(label: string): boolean {
  return corpusIndex(label) !== -1;
}

/** First label in R-order that has no entry in `completed`. */
export function nextUncompleted(completed: Iterable<string>): string | null {
  const done = new Set(completed);
  for (const item of CORPUS) {
    if (!done.has(item.label)) return item.label;
  }
  return null;
}

/**
 * URL of a corpus record's JPG. Images live in a private Supabase Storage
 * bucket (see scripts/prepare-corpus.mjs and scripts/upload-corpus.mjs) and
 * are served through an authenticated, same-origin route so the browser canvas
 * used by OCR is not tainted.
 */
export function corpusImageUrl(label: string): string {
  return `/api/corpus/${encodeURIComponent(label)}`;
}
