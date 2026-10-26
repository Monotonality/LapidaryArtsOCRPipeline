// Shared field model for the six job-card fields used by the records ledger
// and the study forms: per-field status (value / N/A / Invalid) and the
// MM-DD-YY date format every date input uses.

export const FIELD_KEYS = [
  "client_name",
  "phone_number",
  "date",
  "date_promised",
  "instructions",
  "price",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export const DATE_KEYS: readonly FieldKey[] = ["date", "date_promised"];

export const FIELD_LABELS: Record<FieldKey, string> = {
  client_name: "Client name",
  phone_number: "Phone number",
  date: "Date",
  date_promised: "Date promised",
  instructions: "Instructions",
  price: "Price",
};

// "na": the field is not on the card. "invalid": the field is on the card but
// unreadable or not a valid value. Either way the value column is left null and
// the key is listed in na_fields / invalid_fields.
export type FieldStatus = "value" | "na" | "invalid";
export type StatusMap = Record<FieldKey, FieldStatus>;

export const STATUS_TEXT: Record<Exclude<FieldStatus, "value">, string> = {
  na: "N/A",
  invalid: "Invalid",
};

export const EMPTY_STATUS: StatusMap = {
  client_name: "value",
  phone_number: "value",
  date: "value",
  date_promised: "value",
  instructions: "value",
  price: "value",
};

export function isFieldKey(value: unknown): value is FieldKey {
  return typeof value === "string" && (FIELD_KEYS as readonly string[]).includes(value);
}

export type StatusColumns = {
  na_fields?: string[] | null;
  invalid_fields?: string[] | null;
};

/** Build a status map from a row's na_fields / invalid_fields columns. */
export function statusFromRow(
  row: (StatusColumns & Partial<Record<FieldKey, unknown>>) | null | undefined,
): StatusMap {
  const status = { ...EMPTY_STATUS };
  if (!row) return status;
  for (const key of row.na_fields ?? []) if (isFieldKey(key)) status[key] = "na";
  for (const key of row.invalid_fields ?? []) if (isFieldKey(key)) status[key] = "invalid";
  // Older rows stored the marker text in the value column itself.
  for (const key of FIELD_KEYS) {
    if (status[key] !== "value") continue;
    if (row[key] === STATUS_TEXT.na) status[key] = "na";
    else if (row[key] === STATUS_TEXT.invalid) status[key] = "invalid";
  }
  return status;
}

/** Split a status map into the two array columns stored in Supabase. */
export function statusToColumns(status: StatusMap): {
  na_fields: FieldKey[];
  invalid_fields: FieldKey[];
} {
  return {
    na_fields: FIELD_KEYS.filter((key) => status[key] === "na"),
    invalid_fields: FIELD_KEYS.filter((key) => status[key] === "invalid"),
  };
}

/** Read the comma-separated na_fields / invalid_fields hidden inputs. */
export function statusFromForm(formData: FormData): StatusMap {
  const status = { ...EMPTY_STATUS };
  const list = (name: string) =>
    String(formData.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(isFieldKey);
  for (const key of list("na_fields")) status[key] = "na";
  for (const key of list("invalid_fields")) status[key] = "invalid";
  return status;
}

/** Display text for a field: the marker when flagged, else the value. */
export function displayValue(
  status: FieldStatus,
  value: string | number | null | undefined,
): string {
  if (status !== "value") return STATUS_TEXT[status];
  if (value === null || value === undefined) return "";
  return String(value);
}

// ---------------------------------------------------------------------------
// Dates: typed MM-DD-YY with hyphens.
// ---------------------------------------------------------------------------

export const DATE_PLACEHOLDER = "MM-DD-YY";

/**
 * Format keystrokes into MM-DD-YY. Digits only; hyphens are inserted
 * automatically. Typing a separator after a single digit pads it ("1-" ->
 * "01"), so "1/5/24" becomes "01-05-24". Pasted full dates are normalized.
 */
export function formatDateInput(raw: string): string {
  const pasted = normalizeDate(raw);
  if (pasted && /[^\d]/.test(raw.trim()) && raw.trim().length >= 6) return pasted;

  const trailingSep = /[^\d]$/.test(raw);
  const groups = raw.split(/[^\d]+/).filter(Boolean);
  let digits = "";
  groups.forEach((group, i) => {
    const last = i === groups.length - 1;
    if (last && trailingSep && group.length === 1 && digits.length < 4) {
      digits += `0${group}`;
    } else {
      digits += group;
    }
  });
  digits = digits.slice(0, 6);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)]
    .filter(Boolean)
    .join("-");
}

function fullYear(yy: number): number {
  return (yy <= 49 ? 2000 : 1900) + yy;
}

function realDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function mdy(month: number, day: number, year: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(month)}-${p(day)}-${p(year % 100)}`;
}

/** True when value is a complete, real MM-DD-YY date. */
export function isValidDate(value: string): boolean {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(value);
  return Boolean(m && realDate(fullYear(Number(m[3])), Number(m[1]), Number(m[2])));
}

/**
 * Convert loose date text (M/D/YY, M-D-YYYY, YYYY-MM-DD, MMDDYY) to MM-DD-YY.
 * Returns null when it is not a real date.
 */
export function normalizeDate(value: string | null | undefined): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return realDate(y, mo, d) ? mdy(mo, d, y) : null;
  }

  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(s) ?? /^(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (m) {
    const [mo, d] = [Number(m[1]), Number(m[2])];
    const y = m[3].length === 2 ? fullYear(Number(m[3])) : Number(m[3]);
    return realDate(y, mo, d) ? mdy(mo, d, y) : null;
  }
  return null;
}

/** MM-DD-YY -> YYYY-MM-DD for Postgres date columns. */
export function dateToIso(value: string): string | null {
  if (!isValidDate(value)) return null;
  const [mm, dd, yy] = value.split("-");
  return `${fullYear(Number(yy))}-${mm}-${dd}`;
}

/** YYYY-MM-DD (or anything normalizeDate accepts) -> MM-DD-YY for display. */
export function isoToDate(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeDate(value) ?? value;
}

// ---------------------------------------------------------------------------
// Server-side parsing shared by the add, edit and study save actions.
// ---------------------------------------------------------------------------

export type ParsedRecord = {
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  instructions: string | null;
  price: number | null;
  na_fields: FieldKey[];
  invalid_fields: FieldKey[];
};

/**
 * Read the six fields plus their status from a submitted form. Flagged fields
 * are stored as null. Dates must be MM-DD-YY; `dateStorage: "iso"` converts
 * them for Postgres date columns, `"text"` keeps MM-DD-YY.
 */
export function parseRecordForm(
  formData: FormData,
  dateStorage: "iso" | "text",
): { record: ParsedRecord } | { error: string } {
  const status = statusFromForm(formData);
  const read = (key: FieldKey) =>
    status[key] === "value" ? String(formData.get(key) ?? "").trim() : "";

  const dates: Partial<Record<FieldKey, string | null>> = {};
  for (const key of DATE_KEYS) {
    const raw = read(key);
    if (!raw) {
      dates[key] = null;
      continue;
    }
    if (!isValidDate(raw)) {
      return {
        error: `${FIELD_LABELS[key]} must be a real date typed as MM-DD-YY, e.g. 03-14-24. Tick Invalid if the card's date can't be used.`,
      };
    }
    dates[key] = dateStorage === "iso" ? dateToIso(raw) : raw;
  }

  const rawPrice = read("price").replace(/^\$/, "").replaceAll(",", "");
  const price = rawPrice === "" ? null : Number(rawPrice);
  if (price !== null && !Number.isFinite(price)) {
    return { error: "Price must be a number, e.g. 125.50. Tick Invalid if the card's price can't be used." };
  }

  return {
    record: {
      client_name: read("client_name") || null,
      phone_number: read("phone_number") || null,
      date: dates.date ?? null,
      date_promised: dates.date_promised ?? null,
      instructions: read("instructions") || null,
      price,
      ...statusToColumns(status),
    },
  };
}
