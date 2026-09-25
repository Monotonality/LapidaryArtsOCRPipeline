export const FIELD_KEYS = [
  "client_name",
  "phone_number",
  "date",
  "date_promised",
  "instructions",
  "price",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
export type Rect = { x: number; y: number; width: number; height: number };
export type OcrLine = { id: number; text: string; score: number; rect: Rect };
export type Suggestion = { raw: string; value: string; rect: Rect; lineIds: number[] };
export type Suggestions = Partial<Record<FieldKey, Suggestion>>;

type RawLine = { text: string; score: number; poly: [number, number][] };

const LABELS: Array<[FieldKey, RegExp]> = [
  ["date_promised", /^\s*(?:date\s*promis(?:ed)?|promis(?:ed)?\s*date|promis(?:ed)?|due\s*date|ready\s*(?:by|date)?|pickup\s*date)\b\s*[:.\-]?\s*/i],
  ["client_name", /^\s*(?:client(?:\s*name)?|customer(?:\s*name)?|name)\b(?!['’]s)\s*[:.\-]?\s*/i],
  ["phone_number", /^\s*(?:phone|telephone|tel|mobile|cell)\b\s*[:.\-]?\s*/i],
  ["date", /^\s*(?:received\s*date|date\s*received|date(?!\s*picked\s*up\b))\b\s*[:.\-]?\s*/i],
  ["instructions", /^\s*(?:instructions?|article\s*details?|description|details?|work\s*to\s*be\s*done|repair)\b\s*[:.\-]?\s*/i],
  ["price", /^\s*(?:price|total|amount\s*due|repair\s*price|charge)\b\s*[:.\-]?\s*/i],
];
const OTHER_LABEL = /^\s*(?:address|city|state|zip(?:\s*code)?|charges|deposit|balance|date\s*picked\s*up|customer'?s\s*signature)\b\s*[:.\-]?\s*$/i;
const PHONE = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/;
const MONEY = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/;
const DATE = /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function lineRect(poly: [number, number][], width: number, height: number): Rect {
  const xs = poly.map(([x]) => x);
  const ys = poly.map(([, y]) => y);
  const x = clamp(Math.min(...xs) / width);
  const y = clamp(Math.min(...ys) / height);
  return {
    x,
    y,
    width: clamp(Math.max(...xs) / width) - x,
    height: clamp(Math.max(...ys) / height) - y,
  };
}

export function toLines(items: RawLine[], width: number, height: number): OcrLine[] {
  return items
    .map((item, id) => ({
      id,
      text: item.text.trim(),
      score: item.score,
      rect: lineRect(item.poly, width, height),
    }))
    .filter((line) => line.text && line.rect.width > 0 && line.rect.height > 0)
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
}

function labelOf(text: string): { field: FieldKey; rest: string } | null {
  for (const [field, pattern] of LABELS) {
    const match = text.match(pattern);
    if (match) return { field, rest: text.slice(match[0].length).trim() };
  }
  return null;
}

function readDate(raw: string): string {
  const match = raw.match(DATE);
  if (!match) return "";
  const text = match[0];
  const parts = text.split(/[-/.]/).map(Number);
  let year: number, month: number, day: number;
  if (String(parts[0]).length === 4) [year, month, day] = parts;
  else [month, day, year] = parts;
  // A two-digit year is ambiguous on historical records. Staff must resolve it.
  if (year < 100) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeValue(field: FieldKey, raw: string): string {
  const trimmed = raw.trim();
  const label = labelOf(trimmed);
  const text = label?.field === field && label.rest ? label.rest : trimmed;
  if (field === "date" || field === "date_promised") return readDate(text);
  if (field === "phone_number") return text.match(PHONE)?.[0] ?? "";
  if (field === "price") {
    const amount = text.match(MONEY)?.[1];
    return amount ? amount.replaceAll(",", "") : "";
  }
  return text;
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function nearbyValue(label: OcrLine, lines: OcrLine[]): OcrLine | undefined {
  const candidates = lines
    .filter((line) => line.id !== label.id && !labelOf(line.text) && !OTHER_LABEL.test(line.text))
    .map((line) => {
      const verticalGap = line.rect.y - (label.rect.y + label.rect.height);
      const sameRow = Math.abs(line.rect.y - label.rect.y) < Math.max(label.rect.height, line.rect.height) * 0.8;
      const right = line.rect.x >= label.rect.x + label.rect.width - 0.015;
      const below = verticalGap >= -0.01 && verticalGap < 0.055 &&
        line.rect.x < label.rect.x + Math.max(label.rect.width, 0.25);
      if (!((sameRow && right) || below)) return null;
      const distance = sameRow
        ? line.rect.x - (label.rect.x + label.rect.width) + Math.abs(line.rect.y - label.rect.y)
        : verticalGap + Math.abs(line.rect.x - label.rect.x) * 0.2 + 0.02;
      return { line, distance };
    })
    .filter((x): x is { line: OcrLine; distance: number } => x !== null)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.line;
}

function makeSuggestion(field: FieldKey, raw: string, rect: Rect, lineIds: number[]): Suggestion {
  return { raw, value: normalizeValue(field, raw), rect, lineIds };
}

export function proposeFields(lines: OcrLine[]): Suggestions {
  const proposed: Suggestions = {};
  const used = new Set<number>();

  for (const line of lines) {
    const label = labelOf(line.text);
    if (!label || proposed[label.field]) continue;
    let raw = label.rest;
    let rect = line.rect;
    const ids = [line.id];
    if (!raw) {
      const valueLine = nearbyValue(line, lines.filter((candidate) => !used.has(candidate.id)));
      if (!valueLine) continue;
      raw = valueLine.text;
      rect = union(rect, valueLine.rect);
      ids.push(valueLine.id);
    }
    if (label.field === "instructions") {
      const lastY = rect.y + rect.height;
      const extra = lines.filter((candidate) =>
        !ids.includes(candidate.id) && !used.has(candidate.id) && !labelOf(candidate.text) &&
        candidate.rect.y >= lastY && candidate.rect.y < lastY + 0.10 &&
        candidate.rect.x < rect.x + Math.max(rect.width, 0.3));
      for (const additional of extra.slice(0, 3)) {
        raw += `\n${additional.text}`;
        rect = union(rect, additional.rect);
        ids.push(additional.id);
      }
    }
    const suggestion = makeSuggestion(label.field, raw, rect, ids);
    // Keep two-digit dates as evidence, but never treat unrelated nearby words as dates.
    if (!suggestion.value && !((label.field === "date" || label.field === "date_promised") && DATE.test(raw))) continue;
    if (label.field === "client_name" && !/[a-z]{2}/i.test(suggestion.value)) continue;
    proposed[label.field] = suggestion;
    ids.forEach((id) => used.add(id));
  }

  // A phone or amount elsewhere on the form may belong to the shop or a
  // different charge, so unlabeled values wait for staff selection.
  return proposed;
}
