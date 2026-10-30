"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useActionState,
} from "react";
import { CORPUS, corpusImageUrl } from "./corpus";
import { saveStudyValidation } from "./actions";
import { displayValue, statusFromRow } from "@/lib/record-fields";
import styles from "./study.module.css";

export type ValidatorEntry = {
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  instructions: string | null;
  price: number | null;
  na_fields: string[] | null;
  invalid_fields: string[] | null;
};

export type ExistingValidation = {
  major_correction: boolean;
  wrong_client_name: boolean;
  wrong_phone_number: boolean;
  wrong_date: boolean;
  wrong_date_promised: boolean;
  wrong_instructions: boolean;
  wrong_price: boolean;
  novel_promissory_format: boolean;
  notes: string | null;
};

type BrowseFilter =
  | "all"
  | "major"
  | "wrong_date_promised"
  | "wrong_date_promised_novel"
  | "wrong_date_promised_not_novel";

const BROWSE_OPTIONS: { value: BrowseFilter; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "major", label: "Major correction" },
  { value: "wrong_date_promised", label: "Wrong date promised" },
  {
    value: "wrong_date_promised_novel",
    label: "Wrong date promised · novel format",
  },
  {
    value: "wrong_date_promised_not_novel",
    label: "Wrong date promised · not novel",
  },
];

const WRONG_KEYS = [
  "wrong_client_name",
  "wrong_phone_number",
  "wrong_date",
  "wrong_date_promised",
  "wrong_instructions",
  "wrong_price",
] as const;

type WrongKey = (typeof WRONG_KEYS)[number];

const FIELD_ROWS: { key: WrongKey; label: string; mono?: boolean }[] = [
  { key: "wrong_client_name", label: "Client name" },
  { key: "wrong_phone_number", label: "Phone number", mono: true },
  { key: "wrong_date", label: "Date", mono: true },
  { key: "wrong_date_promised", label: "Date promised", mono: true },
  { key: "wrong_price", label: "Price", mono: true },
  { key: "wrong_instructions", label: "Instructions" },
];

const VALUE_KEYS = [
  "client_name",
  "phone_number",
  "date",
  "date_promised",
  "price",
  "instructions",
] as const;

function fieldValue(
  entry: ValidatorEntry | undefined | null,
  key: (typeof VALUE_KEYS)[number],
): string {
  if (!entry) return "";
  return displayValue(statusFromRow(entry)[key], entry[key]);
}

function matchesFilter(
  v: ExistingValidation | undefined,
  filter: BrowseFilter,
): boolean {
  if (filter === "all") return true;
  if (!v) return false;
  if (filter === "major") return v.major_correction;
  if (filter === "wrong_date_promised") return v.wrong_date_promised;
  if (filter === "wrong_date_promised_novel") {
    return v.wrong_date_promised && v.novel_promissory_format;
  }
  return v.wrong_date_promised && !v.novel_promissory_format;
}

export function ValidatorRunner({
  experimentalByLabel,
  controlByLabel,
  validationsByLabel,
}: {
  experimentalByLabel: Record<string, ValidatorEntry>;
  controlByLabel: Record<string, ValidatorEntry>;
  validationsByLabel: Record<string, ExistingValidation>;
}) {
  const [localValidations, setLocalValidations] = useState(validationsByLabel);
  useEffect(() => {
    setLocalValidations(validationsByLabel);
  }, [validationsByLabel]);

  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>("all");

  const pending = useMemo(() => {
    const withEntry = CORPUS.filter(
      (c) => experimentalByLabel[c.label] !== undefined,
    );
    const awaiting = withEntry.filter(
      (c) => localValidations[c.label] === undefined,
    );
    return awaiting.length > 0 ? awaiting : withEntry;
  }, [experimentalByLabel, localValidations]);

  const filteredLabels = useMemo(() => {
    if (browseFilter === "all") {
      return CORPUS.filter(
        (c) => experimentalByLabel[c.label] !== undefined,
      ).map((c) => c.label);
    }
    return CORPUS.filter((c) =>
      matchesFilter(localValidations[c.label], browseFilter),
    ).map((c) => c.label);
  }, [browseFilter, experimentalByLabel, localValidations]);

  const [label, setLabel] = useState<string | null>(
    pending[0]?.label ?? CORPUS[0]?.label ?? null,
  );
  const [verdict, setVerdict] = useState<"yes" | "no" | "">("");
  const [wrongs, setWrongs] = useState<Record<WrongKey, boolean>>({
    wrong_client_name: false,
    wrong_phone_number: false,
    wrong_date: false,
    wrong_date_promised: false,
    wrong_instructions: false,
    wrong_price: false,
  });
  const [novelFormat, setNovelFormat] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoMissing, setPhotoMissing] = useState(false);
  const [audited, setAudited] = useState<Set<string>>(() => {
    const done = new Set<string>();
    for (const c of CORPUS) {
      if (validationsByLabel[c.label]) done.add(c.label);
    }
    return done;
  });

  const [state, formAction, saving] = useActionState(saveStudyValidation, {});
  const handledSaveRef = useRef<number | null>(null);
  const savedAtRef = useRef<number | null>(null);

  // Jump into the filtered list when the browse mode changes.
  useEffect(() => {
    if (filteredLabels.length === 0) return;
    if (label && filteredLabels.includes(label)) return;
    setLabel(filteredLabels[0] ?? null);
    // Only when the user changes Browse — save handling advances on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [browseFilter]);

  // Re-apply stored values and reset local state when the record changes.
  useEffect(() => {
    setPhotoMissing(false);
    if (!label) return;
    const existing = localValidations[label];
    setVerdict(existing ? (existing.major_correction ? "yes" : "no") : "");
    setWrongs({
      wrong_client_name: existing?.wrong_client_name ?? false,
      wrong_phone_number: existing?.wrong_phone_number ?? false,
      wrong_date: existing?.wrong_date ?? false,
      wrong_date_promised: existing?.wrong_date_promised ?? false,
      wrong_instructions: existing?.wrong_instructions ?? false,
      wrong_price: existing?.wrong_price ?? false,
    });
    setNovelFormat(existing?.novel_promissory_format ?? false);
    setNotes(existing?.notes ?? "");
  }, [label, localValidations]);

  // Advance after a successful save.
  useEffect(() => {
    const savedAt = state.savedAt;
    if (!savedAt || !label || handledSaveRef.current === savedAt) return;
    handledSaveRef.current = savedAt;
    savedAtRef.current = savedAt;

    const savedValidation: ExistingValidation = {
      major_correction: verdict === "yes",
      wrong_client_name: wrongs.wrong_client_name,
      wrong_phone_number: wrongs.wrong_phone_number,
      wrong_date: wrongs.wrong_date,
      wrong_date_promised: wrongs.wrong_date_promised,
      wrong_instructions: wrongs.wrong_instructions,
      wrong_price: wrongs.wrong_price,
      novel_promissory_format: novelFormat,
      notes: notes || null,
    };

    setLocalValidations((prev) => ({
      ...prev,
      [label]: savedValidation,
    }));
    setAudited((prev) => {
      const next = new Set(prev);
      next.add(label);
      return next;
    });

    if (browseFilter !== "all") {
      const idx = filteredLabels.indexOf(label);
      const ordered = [
        ...filteredLabels.slice(idx + 1),
        ...filteredLabels.slice(0, idx),
      ];
      const nextInFilter = ordered.find((l) =>
        matchesFilter(localValidations[l], browseFilter),
      );
      if (nextInFilter) setLabel(nextInFilter);
      return;
    }

    const nextUnaudited = CORPUS.find(
      (c) =>
        c.label !== label &&
        experimentalByLabel[c.label] !== undefined &&
        !audited.has(c.label),
    );
    if (nextUnaudited) {
      setLabel(nextUnaudited.label);
    }
  }, [
    state.savedAt,
    label,
    audited,
    experimentalByLabel,
    browseFilter,
    filteredLabels,
    localValidations,
    verdict,
    wrongs,
    novelFormat,
    notes,
  ]);

  const item = CORPUS.find((c) => c.label === label) ?? null;
  const experimental = label ? experimentalByLabel[label] : undefined;
  const control = label ? controlByLabel[label] : undefined;

  const jumpLabels =
    browseFilter === "all"
      ? CORPUS.filter((c) => experimentalByLabel[c.label] !== undefined).map(
          (c) => c.label,
        )
      : filteredLabels;

  const wrongDatePromisedCount = Object.values(localValidations).filter(
    (v) => v.wrong_date_promised,
  ).length;
  const novelAmongWrong = Object.values(localValidations).filter(
    (v) => v.wrong_date_promised && v.novel_promissory_format,
  ).length;

  if (!item) {
    return (
      <p className={styles.empty}>
        {browseFilter === "all"
          ? "Nothing to validate yet. Experimental entries appear here as soon as they are saved."
          : "No audited records match this filter."}
      </p>
    );
  }

  return (
    <>
      <div className={styles.entryBar}>
        <span className={styles.recordLabel}>{item.label}</span>
        <span className={styles.progressText}>
          {audited.size} / {CORPUS.length} audited
        </span>
        <span className={styles.jumpRow}>
          <label htmlFor="vbrowse">Browse</label>
          <select
            id="vbrowse"
            className={styles.select}
            value={browseFilter}
            onChange={(e) => setBrowseFilter(e.target.value as BrowseFilter)}
          >
            {BROWSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </span>
        <span className={styles.jumpRow}>
          <label htmlFor="vjump">Jump to</label>
          <select
            id="vjump"
            className={styles.select}
            value={item.label}
            onChange={(e) => setLabel(e.target.value)}
          >
            {jumpLabels.map((l) => {
              const c = CORPUS.find((row) => row.label === l);
              if (!c) return null;
              const hasEntry = experimentalByLabel[c.label] !== undefined;
              const v = localValidations[c.label];
              const mark = audited.has(c.label)
                ? v?.novel_promissory_format
                  ? " (audited · novel)"
                  : " (audited)"
                : hasEntry
                  ? " (pending)"
                  : "";
              return (
                <option key={c.label} value={c.label}>
                  {c.label}
                  {mark}
                </option>
              );
            })}
          </select>
        </span>
        {browseFilter !== "all" && (
          <span className={styles.progressText}>
            {filteredLabels.length} in filter
          </span>
        )}
      </div>

      <p className={styles.filterHint}>
        Date promised wrong: {wrongDatePromisedCount}
        {wrongDatePromisedCount > 0
          ? ` · novel format ${novelAmongWrong} (${(
              (novelAmongWrong / wrongDatePromisedCount) *
              100
            ).toFixed(0)}%) · excluding novel ${
              wrongDatePromisedCount - novelAmongWrong
            }`
          : ""}
      </p>

      {state.error && (
        <p role="alert" className={styles.alertError}>
          {state.error}
        </p>
      )}
      {state.saved && savedAtRef.current === state.savedAt && (
        <p className={styles.alertSuccess}>Audit saved.</p>
      )}

      <div className={styles.compareGrid}>
        <div className={styles.photoPanel}>
          {photoMissing ? (
            <div className={styles.photoPlaceholder}>
              <span>
                Photo for {item.label} is not prepared yet. Run{" "}
                <code>node scripts/prepare-corpus.mjs</code> to convert the
                HEIC corpus into public/corpus.
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={corpusImageUrl(item.label)}
              alt={`Job card ${item.label}`}
              className={styles.photo}
              onError={() => setPhotoMissing(true)}
            />
          )}
          <span className={styles.photoCaption}>
            {item.label} ({item.file})
          </span>
        </div>

        <div className={styles.compareCol}>
          <span className={styles.compareColHead}>
            Ground truth (control)
          </span>
          {VALUE_KEYS.map((key) => {
            const value = fieldValue(control, key);
            const row = FIELD_ROWS.find((r) => r.key === `wrong_${key}`);
            return (
              <div key={key} className={styles.compareField}>
                <span className={styles.compareFieldLabel}>
                  {row?.label ?? key}
                </span>
                <span
                  className={`${styles.compareValue} ${
                    row?.mono ? styles.compareValueMono : ""
                  } ${value ? "" : styles.compareValueEmpty}`}
                >
                  {value || "not entered"}
                </span>
              </div>
            );
          })}
        </div>

        <form action={formAction} className={styles.compareCol}>
          <input type="hidden" name="corpus_label" value={item.label} />
          <input
            type="hidden"
            name="major_correction"
            value={verdict === "" ? "" : verdict}
          />
          {WRONG_KEYS.map((key) => (
            <input
              key={key}
              type="hidden"
              name={key}
              value={wrongs[key] ? "on" : ""}
            />
          ))}
          <input
            type="hidden"
            name="novel_promissory_format"
            value={novelFormat ? "on" : ""}
          />
          <input type="hidden" name="notes" value={notes} />

          <span className={styles.compareColHead}>
            Experimental transcription
          </span>
          {VALUE_KEYS.map((key) => {
            const value = fieldValue(experimental, key);
            const wrongKey = `wrong_${key}` as WrongKey;
            const row = FIELD_ROWS.find((r) => r.key === wrongKey);
            return (
              <div key={key} className={styles.compareField}>
                <span className={styles.compareFieldLabel}>
                  {row?.label ?? key}
                </span>
                <span
                  className={`${styles.compareValue} ${
                    row?.mono ? styles.compareValueMono : ""
                  } ${value ? "" : styles.compareValueEmpty}`}
                >
                  {value || "empty"}
                </span>
                <label
                  className={`${styles.wrongRow} ${
                    wrongs[wrongKey] ? styles.wrongOn : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={wrongs[wrongKey]}
                    onChange={(e) =>
                      setWrongs((w) => ({
                        ...w,
                        [wrongKey]: e.target.checked,
                      }))
                    }
                  />
                  Mark wrong
                </label>
                {key === "date_promised" && (
                  <label
                    className={`${styles.wrongRow} ${
                      novelFormat ? styles.wrongOn : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={novelFormat}
                      onChange={(e) => setNovelFormat(e.target.checked)}
                    />
                    Novel promissory format
                  </label>
                )}
              </div>
            );
          })}

          <div className={styles.verdictRow}>
            <label className={styles.wrongRow}>
              <input
                type="radio"
                name="verdict-choice"
                checked={verdict === "no"}
                onChange={() => setVerdict("no")}
              />
              Acceptable
            </label>
            <label className={styles.wrongRow}>
              <input
                type="radio"
                name="verdict-choice"
                checked={verdict === "yes"}
                onChange={() => setVerdict("yes")}
              />
              Major correction
            </label>
          </div>

          <label className={styles.field}>
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={styles.textarea}
            />
          </label>

          <div className={styles.actionsRow}>
            <button
              type="submit"
              disabled={saving || verdict === ""}
              className={styles.buttonGreen}
            >
              {saving ? "Saving…" : "Save audit and next"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
