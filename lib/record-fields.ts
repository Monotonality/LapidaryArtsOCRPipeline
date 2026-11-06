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

// ---------------------------------------------------------------------------
// Date promised: cards often say "2-3 weeks" or "10 days ish", not a date.
// ---------------------------------------------------------------------------

export const PROMISED_PLACEHOLDER = "e.g. 11-20-26 or 2-3 weeks";
export const PROMISED_MAX_LENGTH = 100;

export type Duration = { amount: number; unit: "day" | "week" | "month" };

// The whole box must be one duration ("2-3 weeks", "about 10 days ish",
// "3wks", "10 days -"). Text that also says something else ("11/20 or 2
// weeks", "call 2 days before", "3 weeks 2 days") is kept as written with no
// due date, rather than guessing which number is the promise.
const DURATION =
  /^(?:about|approx\.?|around|~)?\s*(\d{1,3})(?:\s*(?:-|–|—|−|‑|to|or)\s*(\d{1,3}))?\s*(days?|d|weeks?|wks?|w|months?|mos?)\.?(?:\s*(?:ish|or so|max|-|–|\?|\.))*$/i;

/**
 * Read a Date promised box that is only a duration, such as "10 days",
 * "2-3 weeks" or "3wks". Ranges use the longer end, since that is the latest
 * the shop promised.
 */
export function parseDuration(text: string): Duration | null {
  const m = DURATION.exec(text.trim());
  if (!m) return null;
  const amount = Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0);
  if (!amount) return null;
  const u = m[3].toLowerCase();
  const unit = u.startsWith("d") ? "day" : u.startsWith("w") ? "week" : "month";
  return { amount, unit };
}

/** MM-DD-YY plus a duration, as MM-DD-YY. */
export function addDuration(date: string, duration: Duration): string | null {
  if (!isValidDate(date)) return null;
  const [mm, dd, yy] = date.split("-").map(Number);
  const out = new Date(Date.UTC(fullYear(yy), mm - 1, dd));
  if (duration.unit === "month") {
    // Clamp to the end of the month: Jan 31 + 1 month is Feb 28, not Mar 3.
    const lastDay = new Date(Date.UTC(fullYear(yy), mm - 1 + duration.amount + 1, 0)).getUTCDate();
    out.setUTCDate(1);
    out.setUTCMonth(out.getUTCMonth() + duration.amount);
    out.setUTCDate(Math.min(dd, lastDay));
  } else {
    out.setUTCDate(
      out.getUTCDate() + duration.amount * (duration.unit === "week" ? 7 : 1),
    );
  }
  return mdy(out.getUTCMonth() + 1, out.getUTCDate(), out.getUTCFullYear());
}

export type ResolvedPromised = {
  /** MM-DD-YY due date, typed or worked out from a duration. */
  date: string | null;
  /** What was written, kept when it is not a plain date. */
  text: string | null;
  /** The duration used to work out `date`, when there was one. */
  duration: Duration | null;
};

/**
 * Turn the Date promised box into what gets stored: a plain date stays a date;
 * anything else is kept as written, and a duration with a known Date received
 * also gets a due date.
 */
export function resolvePromised(
  raw: string,
  received: string | null,
): ResolvedPromised {
  const text = raw.trim();
  if (!text) return { date: null, text: null, duration: null };
  // "11.20.26" is written on cards as often as "11/20/26".
  const asDate = normalizeDate(text.replace(/\./g, "/"));
  if (asDate) return { date: asDate, text: null, duration: null };
  const knownReceived = received && isValidDate(received) ? received : null;
  // "11/20" with no year: the next 11/20 on or after the date received.
  const monthDay = /^(\d{1,2})[/.-](\d{1,2})$/.exec(text);
  if (monthDay && knownReceived) {
    const yy = Number(knownReceived.slice(6));
    const sameYear = normalizeDate(`${monthDay[1]}/${monthDay[2]}/${fullYear(yy)}`);
    if (sameYear) {
      const date = (dateToIso(sameYear) ?? "") >= (dateToIso(knownReceived) ?? "")
        ? sameYear
        : normalizeDate(`${monthDay[1]}/${monthDay[2]}/${fullYear(yy) + 1}`);
      if (date) return { date, text, duration: null };
    }
  }
  const duration = parseDuration(text);
  const date = duration && knownReceived ? addDuration(knownReceived, duration) : null;
  return { date, text, duration: date ? duration : null };
}

/** One-line note under the Date promised box saying how it will be saved. */
export function promisedSummary(raw: string, received: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const resolved = resolvePromised(text, received);
  // A plain date ("11-20-26", "11.20.26") is saved as a date; nothing to explain.
  if (!resolved.text) return null;
  if (resolved.date && resolved.duration) {
    const { amount, unit } = resolved.duration;
    return `Saved as written, due by ${resolved.date} (date received + ${amount} ${unit}${amount === 1 ? "" : "s"}).`;
  }
  if (resolved.date) {
    return `Saved as written, due by ${resolved.date} (year taken from date received).`;
  }
  if (parseDuration(text)) {
    return "Saved as written. Add the date received to work out a due date.";
  }
  return "Saved as written.";
}

/** Dashboard/CSV text for Date promised: what was written, plus the due date. */
export function promisedDisplay(
  text: string | null | undefined,
  isoDate: string | null | undefined,
): string {
  const date = isoToDate(isoDate);
  if (!text) return date;
  return date ? `${text} (by ${date})` : text;
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
  /** Only set for the records ledger (`promisedText: true`). */
  date_promised_text?: string | null;
  instructions: string | null;
  price: number | null;
  na_fields: FieldKey[];
  invalid_fields: FieldKey[];
};

/**
 * Read the six fields plus their status from a submitted form. Flagged fields
 * are stored as null. Dates must be MM-DD-YY; `dateStorage: "iso"` converts
 * them for Postgres date columns, `"text"` keeps MM-DD-YY.
 *
 * With `promisedText`, Date promised is free text ("2-3 weeks"): a plain date
 * is stored as a date, anything else goes to date_promised_text, and a
 * duration also gets a due date worked out from Date received.
 */
export function parseRecordForm(
  formData: FormData,
  dateStorage: "iso" | "text",
  { promisedText = false }: { promisedText?: boolean } = {},
): { record: ParsedRecord } | { error: string } {
  const status = statusFromForm(formData);
  const read = (key: FieldKey) =>
    status[key] === "value" ? String(formData.get(key) ?? "").trim() : "";

  const dates: Partial<Record<FieldKey, string | null>> = {};
  for (const key of DATE_KEYS) {
    if (promisedText && key === "date_promised") continue;
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

  let promisedTextValue: string | null = null;
  if (promisedText) {
    const raw = read("date_promised");
    if (raw.length > PROMISED_MAX_LENGTH) {
      return { error: `Date promised must be ${PROMISED_MAX_LENGTH} characters or fewer.` };
    }
    const received = read("date");
    const resolved = resolvePromised(raw, isValidDate(received) ? received : null);
    promisedTextValue = resolved.text;
    dates.date_promised = resolved.date
      ? dateStorage === "iso" ? dateToIso(resolved.date) : resolved.date
      : null;
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
      ...(promisedText ? { date_promised_text: promisedTextValue } : {}),
      instructions: read("instructions") || null,
      price,
      ...statusToColumns(status),
    },
  };
}
