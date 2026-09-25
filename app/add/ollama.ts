import { FIELD_KEYS, type FieldKey } from "./field-mapper";

export const OLLAMA_URL = "http://localhost:11434";
export const OLLAMA_MODEL = "qwen3-vl:4b-thinking";
export const GEMMA_MODEL = "gemma4:e2b";
const READ_TIMEOUT_MS = 300_000;

export type ModelField = {
  value: string | null;
  evidence: string | null;
  confidence: "high" | "low";
};
export type ModelFields = Record<FieldKey, ModelField>;
export type CheckedField = ModelField & {
  filledValue: string | null;
  reviewValue: string | null;
  reason: string | null;
};
export type CheckedFields = Record<FieldKey, CheckedField>;

const FIELD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"] },
    evidence: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "low"] },
  },
  required: ["value", "evidence", "confidence"],
} as const;

export const INVOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(FIELD_KEYS.map((key) => [key, FIELD_SCHEMA])),
  required: [...FIELD_KEYS],
};

export const SYSTEM_PROMPT = `Read this photographed handwritten jewelry job card. First identify whether it is the older Lapidary Arts form (all-caps labels) or the newer Claim Check form (mixed-case labels). Return exactly the six JSON fields required by the schema. The existing "instructions" field must contain BOTH the handwritten ARTICLE / Articles and Customer's Estimated Value text AND the handwritten INSTRUCTIONS text, in that order, separated by a newline. Do not add an article database field.

Transcribe exactly what is written. Do not fix spelling, expand abbreviations, normalize phone numbers, infer area codes, or invent missing text. Handwriting can overflow boxes and cover printed labels. For each field, evidence MUST quote the exact handwritten value (including numbers) and identify its location or printed label. An evidence string such as "NAME field handwritten" without the actual writing is insufficient. If no legible source exists, use null. Set confidence low if any character or field association is uncertain. Use null for a truly blank or illegible field. Never output a plausible guess.

The printed store phone 972-964-1090 in the footer is NEVER the customer phone. Older customer phones may have one leading digit followed by a closing parenthesis and a seven-digit local number; return only the characters actually written, with no completed area code. The printed ticket number is not any of the six fields.

"Date" is DATE RECEIVED, not a diagonal note saying "called <date>" or DATE PICKED UP. Date Promised may be written as a duration such as "10 days" or "2-3 weeks"; preserve that literal duration. A blank Date Received or Date Promised remains null.

Instructions can contain individually priced line items. These are never the total. "Price" means the final handwritten TOTAL CHARGES amount, even if it sits one row away from its label. If a total is crossed out and rewritten, choose only the clearly corrected amount. If the correction is ambiguous, use null. Do not use DEPOSIT, BALANCE, item prices, or the article's estimated value as Price.

Return only JSON matching the supplied schema. Do not put reasoning in a field.`;

export function imageToBase64(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // createImageBitmap applies the photo's EXIF orientation before drawing.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      resolve(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]);
    } catch (error) {
      reject(error);
    }
  });
}

export async function checkOllama(model = OLLAMA_MODEL, signal?: AbortSignal): Promise<"ready" | "missing-model"> {
  const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Ollama health check failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("models" in data) || !Array.isArray(data.models)) {
    throw new Error("Ollama returned an invalid model list.");
  }
  return data.models.some((item) => item && typeof item === "object" && "name" in item && item.name === model)
    ? "ready" : "missing-model";
}

export function parseFields(content: string): ModelFields {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Model returned invalid JSON fields.");
  for (const key of FIELD_KEYS) {
    const field = (parsed as Record<string, unknown>)[key];
    if (!field || typeof field !== "object") throw new Error(`Model omitted ${key}.`);
    const item = field as Record<string, unknown>;
    if ((item.value !== null && typeof item.value !== "string") ||
        (item.evidence !== null && typeof item.evidence !== "string") ||
        (item.confidence !== "high" && item.confidence !== "low")) {
      throw new Error(`Model returned an invalid ${key} field.`);
    }
  }
  return parsed as ModelFields;
}

export async function readWithOllama(file: File, signal: AbortSignal, model = OLLAMA_MODEL): Promise<{ fields: ModelFields; seconds: number }> {
  const started = performance.now();
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(new Error("Ollama timed out after 300 seconds.")), READ_TIMEOUT_MS);
  const onAbort = () => timeout.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const image = await imageToBase64(file);
    if (signal.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Extract the six invoice fields from this image. JSON schema: ${JSON.stringify(INVOICE_SCHEMA)}`, images: [image] },
        ],
        format: INVOICE_SCHEMA,
        think: true,
        stream: false,
        options: { temperature: 1, top_p: 0.95, top_k: model === GEMMA_MODEL ? 64 : 20, num_predict: 8192, num_ctx: 16384 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${(await response.text()).slice(0, 180)}`);
    const data: unknown = await response.json();
    const message = data && typeof data === "object" && "message" in data ? data.message : null;
    const content = message && typeof message === "object" && "content" in message ? message.content : null;
    if (typeof content !== "string") throw new Error("Ollama did not return a structured response.");
    if (!content.trim()) {
      const meta = data as { done_reason?: string; eval_count?: number };
      throw new Error(`Ollama returned no final JSON (reason: ${meta.done_reason ?? "unknown"}, generated tokens: ${meta.eval_count ?? "unknown"}). Retry or use PaddleOCR.`);
    }
    // message.thinking is deliberately ignored. It is never parsed or displayed.
    try {
      return { fields: parseFields(content), seconds: (performance.now() - started) / 1000 };
    } catch {
      const meta = data as { done_reason?: string; eval_count?: number };
      throw new Error(`Ollama returned malformed final JSON (reason: ${meta.done_reason ?? "unknown"}, generated tokens: ${meta.eval_count ?? "unknown"}, content length: ${content.length}). Retry or use PaddleOCR.`);
    }
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    console.info(`Ollama ${model} invoice read: ${((performance.now() - started) / 1000).toFixed(1)}s`);
  }
}

function parseDate(value: string): string | null {
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = match[3].length === 2 ? (Number(match[3]) <= 49 ? 2000 : 1900) + Number(match[3]) : Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

export function validateFields(fields: ModelFields): CheckedFields {
  const checked = {} as CheckedFields;
  for (const key of FIELD_KEYS) {
    const item = fields[key];
    const value = item.value?.trim() || null;
    let filledValue: string | null = value;
    let reviewValue: string | null = value;
    let reason: string | null = null;
    if (!value) {
      filledValue = null;
      reviewValue = null;
      reason = "Blank or unreadable";
    } else if (key === "phone_number") {
      const digits = value.replace(/\D/g, "");
      if ((digits.length !== 7 && digits.length !== 10) || digits === "9729641090") {
        filledValue = null;
        reason = digits === "9729641090" ? "Store phone is not a customer phone" : "Phone must have 7 or 10 digits";
        if (digits === "9729641090") reviewValue = null;
      } else {
        // A wrong digit can still pass a phone format check. Require a human to confirm it.
        filledValue = null;
        reason = "Confirm handwritten phone digits against the photo";
      }
    } else if (key === "date") {
      filledValue = parseDate(value);
      reviewValue = filledValue;
      if (!filledValue) reason = "Date could not be parsed";
    } else if (key === "date_promised") {
      // records.date_promised is a date column. Preserve durations as suggestions only.
      filledValue = parseDate(value);
      reviewValue = filledValue;
      if (!filledValue) reason = /^\d{1,2}\s*(?:-\s*\d{1,2}\s*)?(?:days?|weeks?|months?)$/i.test(value)
        ? "Duration shown for review; this database field requires a date"
        : "Promised date could not be parsed";
    } else if (key === "price") {
      if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) {
        filledValue = null;
        reviewValue = null;
        reason = "Price is not one amount";
      } else if (!/total\s*charges?/i.test(item.evidence ?? "")) {
        filledValue = null;
        reviewValue = value.replace(/^\$/, "").replaceAll(",", "");
        reason = "No TOTAL CHARGES evidence";
      } else {
        filledValue = value.replace(/^\$/, "").replaceAll(",", "");
        reviewValue = filledValue;
      }
    }
    if (value && item.confidence === "low") {
      filledValue = null;
      reason = reason ? `${reason}; low confidence` : "Low confidence";
    }
    if (value && !item.evidence?.trim()) {
      filledValue = null;
      reason = reason ? `${reason}; no source evidence` : "No source evidence";
    }
    if (value && item.evidence && (key === "phone_number" || key === "date" || key === "date_promised" || key === "price")) {
      const valueDigits = value.replace(/\D/g, "");
      const evidenceDigits = item.evidence.replace(/\D/g, "");
      const label = key === "date" ? /date\s*received/i :
        key === "date_promised" ? /date\s*promised/i :
          key === "phone_number" ? /phone/i : /total\s*charges?/i;
      if (!item.evidence.match(label) || !valueDigits || !evidenceDigits.includes(valueDigits)) {
        filledValue = null;
        reason = reason ? `${reason}; evidence does not quote this field` : "Evidence does not quote this field";
      }
    }
    if (value && (key === "client_name" || key === "instructions")) {
      filledValue = null;
      reason = reason ? `${reason}; handwriting needs staff transcription review` : "Handwriting needs staff transcription review";
    }
    checked[key] = { ...item, value, filledValue, reviewValue, reason };
  }
  return checked;
}
