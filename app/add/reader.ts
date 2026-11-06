import { isHeic, convertHeicToJpeg } from "./heic";
import { PROMISED_MAX_LENGTH } from "@/lib/record-fields";

export const FIELD_KEYS = [
  "client_name",
  "phone_number",
  "date",
  "date_promised",
  "instructions",
  "price",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export const PRESENCE = ["written", "blank", "unreadable"] as const;

/** Whether the card has something written in this field's box. */
export type Presence = (typeof PRESENCE)[number];

export type ModelField = {
  value: string | null;
  evidence: string | null;
  confidence: "high" | "low";
  presence: Presence;
};

export type ModelFields = Record<FieldKey, ModelField>;

export type CheckedField = ModelField & {
  /** Value to pre-fill in the form, or null to leave the box empty. */
  reviewValue: string | null;
  /** Reasons to double-check this field against the photo. Empty when it looks fine. */
  issues: string[];
};

export type CheckedFields = Record<FieldKey, CheckedField>;

const FIELD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"] },
    evidence: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "low"] },
    presence: { type: "string", enum: [...PRESENCE] },
  },
  required: ["value", "evidence", "confidence", "presence"],
} as const;

export const INVOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(FIELD_KEYS.map((key) => [key, FIELD_SCHEMA])),
  required: [...FIELD_KEYS],
};

export const SYSTEM_PROMPT = `Read this photographed handwritten jewelry job card. First identify whether it is the older Lapidary Arts form (all-caps labels) or the newer Claim Check form (mixed-case labels). Return exactly the six JSON fields required by the schema. The existing "instructions" field must contain BOTH the handwritten ARTICLE / Articles and Customer's Estimated Value text AND the handwritten INSTRUCTIONS text, in that order, separated by a newline. Do not add an article database field.

Transcribe exactly what is written. Do not fix spelling, expand abbreviations, normalize phone numbers, infer area codes, or invent missing text. Handwriting can overflow boxes and cover printed labels. For each field, evidence MUST quote the exact handwritten value (including numbers) and identify its location or printed label. An evidence string such as "NAME field handwritten" without the actual writing is insufficient. If no legible source exists, use null. Set confidence low if any character or field association is uncertain. Never output a plausible guess.

For each field also set presence: "written" when you transcribed a value; "blank" when that field's box on the card is empty, with nothing handwritten in it; "unreadable" when something is written there but you cannot read it reliably. Blank and unreadable fields have value null and evidence null. Do not mark a field blank just because it is hard to see; if you are unsure whether anything is written, use "unreadable".

The printed store phone 972-964-1090 in the footer is NEVER the customer phone. Older customer phones may have one leading digit followed by a closing parenthesis and a seven-digit local number; return only the characters actually written, with no completed area code. The printed ticket number is not any of the six fields.

"Date" is DATE RECEIVED, not a diagonal note saying "called <date>" or DATE PICKED UP. Date Promised is often written as a duration such as "10 days", "2-3 weeks" or "10 days ish", or as other text; preserve exactly what is written. A blank Date Received or Date Promised is null with presence "blank".

Instructions can contain individually priced line items. These are never the total. "Price" means the final handwritten TOTAL CHARGES amount, even if it sits one row away from its label. If a total is crossed out and rewritten, choose only the clearly corrected amount. If the correction is ambiguous, use null. Do not use DEPOSIT, BALANCE, item prices, or the article's estimated value as Price.

Return only JSON matching the supplied schema. Do not put reasoning in a field.`;

function imageElementToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          throw new Error("The image has invalid dimensions.");
        }
        const scale = Math.min(1, 1600 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is unavailable in this browser.");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode this photo. Please choose a valid JPEG or PNG image."));
    };
    img.src = url;
  });
}

export async function imageToBase64(file: File): Promise<string> {
  let fileToProcess = file;
  if (await isHeic(file)) {
    fileToProcess = await convertHeicToJpeg(file);
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(fileToProcess, { imageOrientation: "from-image" });
  } catch {
    try {
      bitmap = await createImageBitmap(fileToProcess);
    } catch {
      bitmap = null;
    }
  }

  if (bitmap) {
    try {
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    } catch {
      bitmap.close();
    }
  }

  return await imageElementToBase64(fileToProcess);
}

export function parseFields(content: string): ModelFields {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Model returned invalid JSON fields.");
  const fields = {} as ModelFields;
  for (const key of FIELD_KEYS) {
    const field = (parsed as Record<string, unknown>)[key];
    if (!field || typeof field !== "object") throw new Error(`Model omitted ${key}.`);
    const item = field as Record<string, unknown>;
    if ((item.value !== null && typeof item.value !== "string") ||
        (item.evidence !== null && typeof item.evidence !== "string") ||
        (item.confidence !== "high" && item.confidence !== "low")) {
      throw new Error(`Model returned an invalid ${key} field.`);
    }
    // A model that skips presence should not fail the whole read. Without it a
    // missing value cannot be called blank, so treat it as unreadable.
    const presence: Presence = (PRESENCE as readonly unknown[]).includes(item.presence)
      ? (item.presence as Presence)
      : item.value ? "written" : "unreadable";
    fields[key] = {
      value: item.value as string | null,
      evidence: item.evidence as string | null,
      confidence: item.confidence,
      presence,
    };
  }
  return fields;
}

export function parseDate(value: string): string | null {
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
    if (!value) {
      checked[key] = {
        ...item,
        value: null,
        presence: item.presence === "blank" ? "blank" : "unreadable",
        reviewValue: null,
        issues: [],
      };
      continue;
    }

    let reviewValue: string | null = value;
    const issues: string[] = [];

    if (key === "phone_number") {
      const digits = value.replace(/\D/g, "");
      if (digits === "9729641090") {
        reviewValue = null;
        issues.push("AI picked up the store's phone, not the customer's");
      } else if (
        digits.length !== 7 && digits.length !== 10 &&
        // Older cards write one area-code digit then the local number: "9) 890-2734".
        !(digits.length === 8 && /^\s*\(?\s*\d\s*\)/.test(value))
      ) {
        issues.push(`Has ${digits.length} digits; phone numbers have 7 or 10`);
      }
    } else if (key === "date") {
      reviewValue = parseDate(value);
      if (!reviewValue) issues.push(`Read as "${value}", which isn't a full date`);
    } else if (key === "date_promised") {
      // Free text: dates, durations ("2-3 weeks") and notes are all kept as written.
      reviewValue = value.slice(0, PROMISED_MAX_LENGTH);
      if (value.length > PROMISED_MAX_LENGTH) {
        issues.push(`Cut to ${PROMISED_MAX_LENGTH} characters`);
      }
    } else if (key === "price") {
      // Handwritten whole-dollar prices are often written "125.-" or "125-".
      const trimmed = value.replace(/^\$\s*/, "").replace(/(?:\.|\s)*-+$/, "");
      // Commas only as thousands separators: "1,234.50" yes, "12,50" no.
      const amount = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(trimmed) ? trimmed.replaceAll(",", "") : trimmed;
      if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
        reviewValue = null;
        issues.push(`Read as "${value}", which isn't one amount`);
      } else {
        reviewValue = amount;
        if (!/total\s*charges?/i.test(item.evidence ?? "")) {
          issues.push("May not be the TOTAL CHARGES amount");
        }
      }
    }

    if (item.confidence === "low" || item.presence === "unreadable") {
      issues.push("AI wasn't sure about this one");
    }
    if (!item.evidence?.trim()) {
      issues.push("AI didn't quote the card for this");
    } else if (key === "phone_number" || key === "date" || key === "date_promised" || key === "price") {
      const valueDigits = value.replace(/\D/g, "");
      const evidenceDigits = item.evidence.replace(/\D/g, "");
      const label = key === "date" ? /date\s*rec/i :
        key === "date_promised" ? /promised/i :
          key === "phone_number" ? /phone|\bph\b|\btel\b/i : /total/i;
      if (!label.test(item.evidence) || (valueDigits && !evidenceDigits.includes(valueDigits))) {
        issues.push("AI's quote doesn't match this field");
      }
    }

    checked[key] = { ...item, value, presence: "written", reviewValue, issues };
  }
  return checked;
}
