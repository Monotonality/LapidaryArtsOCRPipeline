"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidLabel } from "./corpus";
import { parseRecordForm } from "@/lib/record-fields";

export type StudyCondition = "control" | "experimental";

export type StudyEntryRow = {
  id: string;
  condition: StudyCondition;
  corpus_label: string;
  participant: string;
  opened_at: string;
  submitted_at: string;
  duration_seconds: number;
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  instructions: string | null;
  price: number | null;
  na_fields: string[] | null;
  invalid_fields: string[] | null;
  input_tokens: number | null;
  output_tokens: number | null;
  interrupted: boolean;
};

export type StudyValidationRow = {
  id: string;
  corpus_label: string;
  validator: string;
  major_correction: boolean;
  wrong_client_name: boolean;
  wrong_phone_number: boolean;
  wrong_date: boolean;
  wrong_date_promised: boolean;
  wrong_instructions: boolean;
  wrong_price: boolean;
  novel_promissory_format: boolean;
  notes: string | null;
  validated_at: string;
};

export type StudyArchiveRow = {
  id: string;
  label: string;
  created_by: string;
  created_at: string;
  control_count: number;
  experimental_count: number;
  validation_count: number;
  snapshot: {
    entries: StudyEntryRow[];
    validations: StudyValidationRow[];
  };
};

type EntryState = { error?: string; saved?: boolean; savedAt?: number };
type ValidationState = { error?: string; saved?: boolean; savedAt?: number };
type ArchiveState = { error?: string; saved?: boolean };
type ExtractState = {
  error?: string;
  fields?: {
    client_name: string;
    phone_number: string;
    date: string;
    date_promised: string;
    instructions: string;
    price: string;
  };
  input_tokens?: number | null;
  output_tokens?: number | null;
  raw?: string;
};

export async function saveStudyEntry(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to save a study entry." };
  }

  const condition = String(formData.get("condition") ?? "");
  const corpusLabel = String(formData.get("corpus_label") ?? "").trim();
  const openedAtRaw = String(formData.get("opened_at") ?? "").trim();

  if (condition !== "control" && condition !== "experimental") {
    return { error: "Unknown study condition." };
  }
  if (!isValidLabel(corpusLabel)) {
    return { error: `Unknown corpus record: ${corpusLabel || "(empty)"}` };
  }

  const openedAt = new Date(openedAtRaw);
  const now = Date.now();
  if (
    Number.isNaN(openedAt.getTime()) ||
    openedAt.getTime() > now + 60_000 ||
    openedAt.getTime() < now - 12 * 3_600_000
  ) {
    return {
      error: "The open timestamp is invalid. Reload the page and try again.",
    };
  }

  const read = (key: string) => String(formData.get(key) ?? "").trim();
  const readInt = (key: string) => {
    const raw = read(key);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const parsed = parseRecordForm(formData, "text");
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from("study_entries").upsert(
    {
      condition,
      corpus_label: corpusLabel,
      participant: user.id,
      opened_at: openedAt.toISOString(),
      submitted_at: new Date(now).toISOString(),
      ...parsed.record,
      input_tokens: condition === "experimental" ? readInt("input_tokens") : null,
      output_tokens:
        condition === "experimental" ? readInt("output_tokens") : null,
      interrupted: false,
      updated_by: user.id,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "condition,corpus_label" },
  );

  if (error) {
    console.error("Failed to save study entry", error);
    return { error: error.message };
  }

  revalidatePath("/study");
  return { saved: true, savedAt: Date.now() };
}

export async function saveStudyValidation(
  _prev: ValidationState,
  formData: FormData,
): Promise<ValidationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to save a validation." };
  }

  const corpusLabel = String(formData.get("corpus_label") ?? "").trim();
  if (!isValidLabel(corpusLabel)) {
    return { error: `Unknown corpus record: ${corpusLabel || "(empty)"}` };
  }

  const verdict = String(formData.get("major_correction") ?? "");
  if (verdict !== "yes" && verdict !== "no") {
    return { error: "Choose whether the record needs major correction." };
  }

  const payload = {
    major_correction: verdict === "yes",
    wrong_client_name: formData.get("wrong_client_name") === "on",
    wrong_phone_number: formData.get("wrong_phone_number") === "on",
    wrong_date: formData.get("wrong_date") === "on",
    wrong_date_promised: formData.get("wrong_date_promised") === "on",
    wrong_instructions: formData.get("wrong_instructions") === "on",
    wrong_price: formData.get("wrong_price") === "on",
    novel_promissory_format:
      formData.get("novel_promissory_format") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
    validated_at: new Date().toISOString(),
  };

  // Prefer update-in-place when the label is already audited so we do not
  // reassign validator (upsert always sent validator: current user and then
  // hit UPDATE USING against the existing owner).
  const { data: existing, error: lookupError } = await supabase
    .from("study_validations")
    .select("id")
    .eq("corpus_label", corpusLabel)
    .maybeSingle();

  if (lookupError) {
    console.error("Failed to look up study validation", lookupError);
    return { error: lookupError.message };
  }

  const { error } = existing
    ? await supabase
        .from("study_validations")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("study_validations").insert({
        corpus_label: corpusLabel,
        validator: user.id,
        ...payload,
      });

  if (error) {
    console.error("Failed to save study validation", error);
    return { error: error.message };
  }

  revalidatePath("/study");
  revalidatePath("/study/validator");
  revalidatePath("/study/overview");
  return { saved: true, savedAt: Date.now() };
}

export async function createStudyArchive(
  _prev: ArchiveState,
  formData: FormData,
): Promise<ArchiveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to archive the dataset." };
  }

  const label =
    String(formData.get("label") ?? "").trim() ||
    `snapshot-${new Date().toISOString().slice(0, 10)}`;

  const [{ data: entries, error: eErr }, { data: validations, error: vErr }] =
    await Promise.all([
      supabase.from("study_entries").select("*").order("condition").order("corpus_label"),
      supabase.from("study_validations").select("*").order("corpus_label"),
    ]);

  if (eErr || vErr) {
    console.error("Failed to read study data for archive", eErr ?? vErr);
    return { error: "Could not read the study dataset." };
  }

  const entryRows = (entries ?? []) as StudyEntryRow[];
  const validationRows = (validations ?? []) as StudyValidationRow[];

  const { error } = await supabase.from("study_archives").insert({
    label,
    created_by: user.id,
    control_count: entryRows.filter((r) => r.condition === "control").length,
    experimental_count: entryRows.filter((r) => r.condition === "experimental")
      .length,
    validation_count: validationRows.length,
    snapshot: { entries: entryRows, validations: validationRows },
  });

  if (error) {
    console.error("Failed to create study archive", error);
    return { error: error.message };
  }

  revalidatePath("/study/overview");
  return { saved: true };
}

const EXTRACTION_PROMPT = `You are transcribing a handwritten jewelry repair/job card photograph.
Extract exactly these six fields: client_name, phone_number, date, date_promised, instructions, price.
Rules:
- phone_number: the handwritten customer phone, keep formatting marks that appear on the card. Never add an area code that is not written. The printed store phone 972-964-1090 is never the customer phone.
- date is the handwritten DATE RECEIVED box; date_promised is only the DATE PROMISED box, which is often blank. Ignore "called <date>" notes.
- date and date_promised: MM-DD-YY (two-digit month, day and year, hyphens) when a full date is visible; empty string otherwise.
- price: numbers only, no currency symbol.
- instructions: the article/repair details, joined with "; " if multiple lines.
- Use an empty string for any field you cannot read confidently.
Respond with ONLY a JSON object of the six fields, no prose, no markdown fence.`;

const EXTRACTION_KEYS = [
  "client_name",
  "phone_number",
  "date",
  "date_promised",
  "instructions",
  "price",
] as const;

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(EXTRACTION_KEYS.map((key) => [key, { type: "string" }])),
  required: [...EXTRACTION_KEYS],
};

export async function extractStudyFields(
  _prev: ExtractState,
  formData: FormData,
): Promise<ExtractState> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      error:
        "OPENROUTER_API_KEY is not set on the server. Add it to .env to enable OCR extraction.",
    };
  }

  const imageDataUrl = String(formData.get("image") ?? "").trim();
  if (!imageDataUrl.startsWith("data:image/")) {
    return { error: "No card image was provided for extraction." };
  }

  const model = process.env.OPENROUTER_MODEL || "qwen/qwen3.8-omni-flash";

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "InkParse Study OCR",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        // Without reasoning the layout rules above keep Date Received out of date_promised,
        // and the schema stops stray text around the JSON.
        reasoning: { enabled: false },
        response_format: {
          type: "json_schema",
          json_schema: { name: "study_fields", strict: true, schema: EXTRACTION_SCHEMA },
        },
      }),
    });
  } catch (err) {
    console.error("OpenRouter request failed", err);
    return { error: "Could not reach the OCR service. Check the network." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("OpenRouter error", res.status, body);
    return { error: `OCR service returned ${res.status}.` };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) {
    return { error: "The OCR service returned no text." };
  }

  const parsed = parseExtractionJson(raw);
  if (!parsed) {
    return { error: "Could not parse the OCR response.", raw };
  }

  revalidatePath("/study");
  return {
    fields: parsed,
    input_tokens: data.usage?.prompt_tokens ?? null,
    output_tokens: data.usage?.completion_tokens ?? null,
    raw,
  };
}

function parseExtractionJson(
  raw: string,
): ExtractState["fields"] | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const str = (k: string) => String(obj[k] ?? "").trim();
    return {
      client_name: str("client_name"),
      phone_number: str("phone_number"),
      date: str("date"),
      date_promised: str("date_promised"),
      instructions: str("instructions"),
      price: str("price"),
    };
  } catch {
    return null;
  }
}
