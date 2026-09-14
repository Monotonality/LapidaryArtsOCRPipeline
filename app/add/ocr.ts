type OcrResult = Array<{ generated_text: string }>;

let transcriber: ((image: unknown, options: object) => Promise<OcrResult>) | null =
  null;

const MODELS = {
  handwritten: "Xenova/trocr-small-handwritten",
  printed: "Xenova/trocr-small-printed",
} as const;

export async function runOcr(
  image: HTMLCanvasElement,
  kind: "handwritten" | "printed",
): Promise<string> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;

  if (!transcriber) {
    transcriber = (await pipeline(
      "image-to-text",
      MODELS[kind],
    )) as (image: unknown, options: object) => Promise<OcrResult>;
  }

  const output = await transcriber(image, { max_new_tokens: 256 });
  return output[0]?.generated_text ?? "";
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

function toIsoDate(raw: string): string {
  const us = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (us) {
    const [, m, d, y] = us;
    return `${y.length === 2 ? "20" + y : y}-${pad(m)}-${pad(d)}`;
  }
  const iso = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  return "";
}

export type ParsedRecord = {
  client_name: string;
  phone_number: string;
  date: string;
  date_promised: string;
  price: string;
  instructions: string;
};

const PHONE_RE = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]\d{4}/;
const DATE_RE = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/;
const PRICE_SYMBOL_RE = /\$?\s*(\d{1,3}(?:[.,]\d{2})?)\b/;
const PRICE_LABEL_RE = /\b(?:price|total|amount|balance|cost)\D{0,24}?(\d{1,3}(?:[.,]\d{2})?)/i;
const HEADER_RE =
  /\b(?:name|client|customer|phone|tel|date|promis|due|ready|pick-?up|price|total|amount|balance|cost|paid|deposit|jewel|repair|ring|watch|invoice|no\.?|received|approved|pending)\b/i;

export function parseOcrText(raw: string): ParsedRecord {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let client = "";
  let phone = "";
  let date = "";
  let datePromised = "";
  let price = "";
  const instructions: string[] = [];

  for (const line of lines) {
    let remaining = line;

    const phoneMatch = remaining.match(PHONE_RE);
    if (!phone && phoneMatch) {
      phone = phoneMatch[0].replace(/\s+/g, "");
      remaining = remaining.replace(phoneMatch[0], "").trim();
    }

    const priceMatch =
      remaining.match(PRICE_LABEL_RE) ??
      (remaining.includes("$") ? remaining.match(PRICE_SYMBOL_RE) : null);
    if (!price && priceMatch) {
      price = priceMatch[1].replace(",", ".");
      remaining = remaining.replace(priceMatch[0], "").trim();
    }

    const dateMatch = remaining.match(DATE_RE);
    if (dateMatch) {
      const iso = toIsoDate(dateMatch[0]);
      if (iso) {
        if (/\b(?:promis|due|ready|pick-?up|done|finish|complet)\b/i.test(line)) {
          if (!datePromised) datePromised = iso;
        } else if (!date) {
          date = iso;
        }
        remaining = remaining.replace(dateMatch[0], "").trim();
      }
    }

    if (!remaining) continue;

    if (/\b(?:promis|due|ready|pick-?up)\b/i.test(remaining)) {
      if (!datePromised && /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(remaining)) {
        const d = remaining.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/)![0];
        datePromised = toIsoDate(d);
      }
      if (HEADER_RE.test(remaining.replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ""))) {
        continue;
      }
    }

    if (HEADER_RE.test(remaining)) {
      const stripped = remaining.replace(HEADER_RE, "").trim();
      if (!stripped) continue;
    }

    if (!client) {
      client = remaining;
    } else {
      if (instructions.length < 4) instructions.push(remaining);
    }
  }

  return {
    client_name: client,
    phone_number: phone,
    date,
    date_promised: datePromised,
    price,
    instructions: instructions.join("; "),
  };
}