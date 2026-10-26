"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useActionState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_STATUS,
  FIELD_KEYS,
  STATUS_TEXT,
  normalizeDate,
  statusFromRow,
  statusToColumns,
  type FieldKey,
  type FieldStatus,
  type StatusMap,
} from "@/lib/record-fields";
import {
  DateInput,
  FieldStatusTicks,
  useKeepScrollWhileTyping,
} from "@/app/field-inputs";
import {
  CORPUS,
  corpusImageUrl,
  type CorpusItem,
} from "./corpus";
import {
  extractStudyFields,
  saveStudyEntry,
  type StudyCondition,
  type StudyEntryRow,
} from "./actions";
import styles from "./study.module.css";

type Fields = Record<FieldKey, string>;

const EMPTY_FIELDS: Fields = {
  client_name: "",
  phone_number: "",
  date: "",
  date_promised: "",
  instructions: "",
  price: "",
};

function rowToFields(row: StudyEntryRow | null | undefined): Fields {
  if (!row) return EMPTY_FIELDS;
  const status = statusFromRow(row);
  const text = (key: FieldKey, v: string | number | null) =>
    status[key] !== "value" || v === null || v === undefined ? "" : String(v);
  return {
    client_name: text("client_name", row.client_name),
    phone_number: text("phone_number", row.phone_number),
    date: text("date", row.date),
    date_promised: text("date_promised", row.date_promised),
    instructions: text("instructions", row.instructions),
    price: text("price", row.price),
  };
}

const FIELD_ROWS: {
  key: FieldKey;
  label: string;
  kind: "text" | "date" | "price" | "textarea";
  mono?: boolean;
  required?: boolean;
}[] = [
  { key: "client_name", label: "Client name", kind: "text", required: true },
  { key: "phone_number", label: "Phone number", kind: "text", mono: true },
  { key: "date", label: "Date", kind: "date", mono: true },
  { key: "date_promised", label: "Date promised", kind: "date", mono: true },
  { key: "price", label: "Price", kind: "price", mono: true },
  { key: "instructions", label: "Instructions / article details", kind: "textarea" },
];

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function EntryRunner({
  condition,
  ocrEnabled,
  initialLabel,
  initialCompleted,
}: {
  condition: StudyCondition;
  ocrEnabled: boolean;
  initialLabel: string | null;
  initialCompleted: string[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(initialCompleted),
  );
  const [label, setLabel] = useState<string | null>(
    initialLabel ?? CORPUS[0]?.label ?? null,
  );
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [status, setStatus] = useState<StatusMap>(EMPTY_STATUS);
  const [modelFields, setModelFields] = useState<Set<string>>(new Set());
  const [openedAtMs, setOpenedAtMs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [photoMissing, setPhotoMissing] = useState(false);
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);
  const [hadPriorEntry, setHadPriorEntry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrNote, setOcrNote] = useState("");
  const [ocrRaw, setOcrRaw] = useState("");
  const [tokens, setTokens] = useState<{
    input: number | null;
    output: number | null;
  }>({ input: null, output: null });

  const [entryState, entryFormAction, entrySaving] = useActionState(
    saveStudyEntry,
    {},
  );
  const handledSaveRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  useKeepScrollWhileTyping(formRef);

  const photoReady = label !== null && loadedLabel === label;

  // Timer ticks only after the photo for this record has finished loading.
  useEffect(() => {
    if (openedAtMs === null) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - openedAtMs);
    const id = setInterval(() => setElapsed(Date.now() - openedAtMs), 1000);
    return () => clearInterval(id);
  }, [openedAtMs]);

  // Load existing values and reset the clock when the record changes.
  useEffect(() => {
    let cancelled = false;
    setPhotoMissing(false);
    setLoadedLabel(null);
    setOpenedAtMs(null);
    setElapsed(0);
    setStatus(EMPTY_STATUS);
    setModelFields(new Set());
    setOcrNote("");
    setOcrRaw("");
    setTokens({ input: null, output: null });

    if (!label) {
      setFields(EMPTY_FIELDS);
      setHadPriorEntry(false);
      return;
    }

    // A cached photo can finish loading before React attaches onLoad.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoadedLabel(label);
      setOpenedAtMs(Date.now());
    }

    supabase
      .from("study_entries")
      .select("*")
      .eq("condition", condition)
      .eq("corpus_label", label)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setFields(rowToFields(data as StudyEntryRow | null));
        setStatus(statusFromRow(data as StudyEntryRow | null));
        setHadPriorEntry(Boolean(data));
      });

    return () => {
      cancelled = true;
    };
  }, [label, condition, supabase]);

  // Advance to the next record after a successful save.
  useEffect(() => {
    const savedAt = entryState.savedAt;
    if (!savedAt || !label) return;
    if (handledSaveRef.current === savedAt) return;
    handledSaveRef.current = savedAt;

    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(label);
      return next;
    });

    const idx = CORPUS.findIndex((c) => c.label === label);
    const after = CORPUS.slice(idx + 1).find((c) => !completed.has(c.label));
    const fallback = CORPUS.find(
      (c) => !completed.has(c.label) && c.label !== label,
    );
    const nextLabel = after?.label ?? fallback?.label ?? null;

    if (nextLabel) {
      setLabel(nextLabel);
    } else {
      setOcrNote("Corpus complete. Every record has been saved.");
    }
  }, [entryState.savedAt, label, completed]);

  function setField(key: FieldKey, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setModelFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handlePhotoLoad() {
    if (!label) return;
    setLoadedLabel(label);
    setOpenedAtMs(Date.now());
  }

  function restartTimer() {
    if (!photoReady) return;
    setOpenedAtMs(Date.now());
  }

  function setFieldStatus(key: FieldKey, next: FieldStatus) {
    setStatus((prev) => ({ ...prev, [key]: next }));
  }

  async function runOcr() {
    if (!label || !photoReady || busy) return;
    const img = document.querySelector<HTMLImageElement>("[data-corpus-image]");
    if (!img || !img.complete || !img.naturalWidth) {
      setOcrNote("The corpus photo is not loaded yet.");
      return;
    }

    setBusy(true);
    setOcrNote("Extracting fields with the OCR model…");
    setOcrRaw("");

    try {
      const canvas = document.createElement("canvas");
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context unavailable");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

      const formData = new FormData();
      formData.set("image", dataUrl);
      const result = await extractStudyFields({}, formData);

      if (result.error) {
        setOcrNote(result.error);
        return;
      }

      const filled = new Set<string>();
      setFields((f) => {
        const next = { ...f };
        for (const key of FIELD_KEYS) {
          let value = result.fields?.[key] ?? "";
          if (value && (key === "date" || key === "date_promised")) {
            // Only a real date can go in a date box; leave the rest for review.
            value = normalizeDate(value) ?? "";
          }
          if (value) {
            next[key] = value;
            filled.add(key);
          }
        }
        return next;
      });
      setStatus((prev) => {
        const next = { ...prev };
        for (const key of filled) next[key as FieldKey] = "value";
        return next;
      });
      setModelFields(filled);
      setTokens({
        input: result.input_tokens ?? null,
        output: result.output_tokens ?? null,
      });
      setOcrRaw(result.raw ?? "");
      setOcrNote(
        "Extraction complete. Fields are filled in — correct anything wrong, then save.",
      );
    } catch (err) {
      console.error(err);
      setOcrNote("Extraction failed. Enter the details by hand.");
    } finally {
      setBusy(false);
    }
  }

  const item: CorpusItem | null = useMemo(
    () => CORPUS.find((c) => c.label === label) ?? null,
    [label],
  );
  const doneCount = completed.size;

  if (!item) {
    return <p className={styles.empty}>No corpus records are available.</p>;
  }

  return (
    <>
      <div className={styles.entryBar}>
        <span className={styles.recordLabel}>{item.label}</span>
        <span className={styles.progressText}>
          {doneCount} / {CORPUS.length} saved
        </span>
        <span className={styles.jumpRow}>
          <label htmlFor="jump">Jump to</label>
          <select
            id="jump"
            className={styles.select}
            value={item.label}
            onChange={(e) => setLabel(e.target.value)}
          >
            {CORPUS.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
                {completed.has(c.label) ? " (saved)" : ""}
              </option>
            ))}
          </select>
        </span>
        <span className={styles.timer} aria-live="off">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {hadPriorEntry && (
        <p className={styles.note}>
          {item.label} was already saved in this condition. Saving again
          overwrites it with a new timing.
        </p>
      )}

      <div className={styles.entryLayout}>
        <div className={styles.photoPanel}>
          {photoMissing ? (
            <div className={styles.photoPlaceholder}>
              <span>
                Photo for {item.label} could not be loaded. Ask an admin to run{" "}
                <code>npm run corpus:prepare</code> and{" "}
                <code>npm run corpus:upload</code>.
              </span>
            </div>
          ) : (
            <div
              className={`${styles.photoWrap} ${
                photoReady ? "" : styles.photoWrapLoading
              }`}
            >
              {/* Hidden until loaded so the timer starts at the same moment the photo appears. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={item.label}
                ref={imgRef}
                data-corpus-image
                src={corpusImageUrl(item.label)}
                alt={`Job card ${item.label}`}
                className={styles.photo}
                style={{ visibility: photoReady ? "visible" : "hidden" }}
                onLoad={handlePhotoLoad}
                onError={() => setPhotoMissing(true)}
              />
              {!photoReady && (
                <span className={styles.photoLoading}>Loading photo…</span>
              )}
            </div>
          )}
          <span className={styles.photoCaption}>
            {item.label} of {CORPUS.length} ({item.file})
          </span>
        </div>

        <form
          ref={formRef}
          action={entryFormAction}
          className={styles.formPanel}
        >
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="corpus_label" value={item.label} />
          <input
            type="hidden"
            name="opened_at"
            value={openedAtMs === null ? "" : new Date(openedAtMs).toISOString()}
          />
          {FIELD_KEYS.map((key) => (
            <input
              key={key}
              type="hidden"
              name={key}
              value={status[key] === "value" ? fields[key] : ""}
            />
          ))}
          <input
            type="hidden"
            name="na_fields"
            value={statusToColumns(status).na_fields.join(",")}
          />
          <input
            type="hidden"
            name="invalid_fields"
            value={statusToColumns(status).invalid_fields.join(",")}
          />
          <input
            type="hidden"
            name="input_tokens"
            value={tokens.input === null ? "" : String(tokens.input)}
          />
          <input
            type="hidden"
            name="output_tokens"
            value={tokens.output === null ? "" : String(tokens.output)}
          />

          {ocrEnabled && (
            <div className={styles.ocrRow}>
              <button
                type="button"
                onClick={runOcr}
                disabled={busy || photoMissing || !photoReady}
                className={styles.button}
              >
                {busy ? "Extracting…" : "Run OCR"}
              </button>
              {modelFields.size > 0 && (
                <button
                  type="button"
                  onClick={() => setModelFields(new Set())}
                  className={styles.buttonQuiet}
                >
                  Accept all
                </button>
              )}
              {ocrNote && <span className={styles.noteModel}>{ocrNote}</span>}
            </div>
          )}

          <div className={styles.fields}>
            {FIELD_ROWS.map((row) => {
              const flagged = status[row.key] !== "value";
              const flagText = flagged
                ? STATUS_TEXT[status[row.key] as "na" | "invalid"]
                : undefined;
              const className = `${
                row.kind === "textarea" ? styles.textarea : styles.input
              } ${row.mono ? styles.inputMono : ""} ${
                modelFields.has(row.key) ? styles.inputModel : ""
              }`;
              const value = flagged ? "" : fields[row.key];
              return (
                <label
                  key={row.key}
                  className={`${styles.field} ${
                    row.kind === "textarea" ? styles.fieldFull : ""
                  }`}
                >
                  <span className={styles.fieldHead}>
                    <span>{row.label}</span>
                    <FieldStatusTicks
                      status={status[row.key]}
                      onChange={(next) => setFieldStatus(row.key, next)}
                      className={styles.naTick}
                    />
                  </span>
                  {row.kind === "date" ? (
                    <DateInput
                      value={value}
                      onValueChange={(v) => setField(row.key, v)}
                      disabled={flagged}
                      placeholder={flagText}
                      className={className}
                    />
                  ) : row.kind === "textarea" ? (
                    <textarea
                      value={value}
                      onChange={(e) => setField(row.key, e.target.value)}
                      disabled={flagged}
                      rows={4}
                      placeholder={flagText}
                      className={className}
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode={row.kind === "price" ? "decimal" : undefined}
                      value={value}
                      onChange={(e) => setField(row.key, e.target.value)}
                      required={row.required && !flagged}
                      disabled={flagged}
                      autoComplete="off"
                      placeholder={
                        flagText ?? (row.kind === "price" ? "e.g. 125.50" : undefined)
                      }
                      className={className}
                    />
                  )}
                </label>
              );
            })}
          </div>

          {entryState.error && (
            <p role="alert" className={styles.alertError}>
              {entryState.error}
            </p>
          )}

          <div className={styles.actionsRow}>
            <button
              type="submit"
              disabled={entrySaving || !photoReady}
              className={styles.buttonGreen}
            >
              {entrySaving ? "Saving…" : "Save and next"}
            </button>
            <button
              type="button"
              onClick={restartTimer}
              disabled={!photoReady}
              className={styles.buttonQuiet}
            >
              Flag interrupted, re-time
            </button>
          </div>

          {ocrRaw && (
            <details className={styles.details}>
              <summary>OCR output</summary>
              <pre className={styles.detailsPre}>{ocrRaw}</pre>
            </details>
          )}
        </form>
      </div>
    </>
  );
}
