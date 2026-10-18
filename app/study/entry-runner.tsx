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

type Fields = {
  client_name: string;
  phone_number: string;
  date: string;
  date_promised: string;
  instructions: string;
  price: string;
};

const EMPTY_FIELDS: Fields = {
  client_name: "",
  phone_number: "",
  date: "",
  date_promised: "",
  instructions: "",
  price: "",
};

const FIELD_KEYS = Object.keys(EMPTY_FIELDS) as (keyof Fields)[];

function rowToFields(row: StudyEntryRow | null | undefined): Fields {
  if (!row) return EMPTY_FIELDS;
  return {
    client_name: row.client_name ?? "",
    phone_number: row.phone_number ?? "",
    date: row.date ?? "",
    date_promised: row.date_promised ?? "",
    instructions: row.instructions ?? "",
    price: row.price === null || row.price === undefined ? "" : String(row.price),
  };
}

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
  const [modelFields, setModelFields] = useState<Set<string>>(new Set());
  const [openedAtMs, setOpenedAtMs] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [photoMissing, setPhotoMissing] = useState(false);
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

  // Timer ticks while the current record is open.
  useEffect(() => {
    setElapsed(Date.now() - openedAtMs);
    const id = setInterval(() => setElapsed(Date.now() - openedAtMs), 1000);
    return () => clearInterval(id);
  }, [openedAtMs]);

  // Load existing values and reset the clock when the record changes.
  useEffect(() => {
    let cancelled = false;
    setPhotoMissing(false);
    setModelFields(new Set());
    setOcrNote("");
    setOcrRaw("");
    setTokens({ input: null, output: null });
    setOpenedAtMs(Date.now());

    if (!label) {
      setFields(EMPTY_FIELDS);
      setHadPriorEntry(false);
      return;
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

  function setField(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setModelFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function restartTimer() {
    setOpenedAtMs(Date.now());
  }

  async function runOcr() {
    if (!label || busy) return;
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
          const value = result.fields?.[key] ?? "";
          if (value) {
            next[key] = value;
            filled.add(key);
          }
        }
        return next;
      });
      setModelFields(filled);
      setTokens({
        input: result.input_tokens ?? null,
        output: result.output_tokens ?? null,
      });
      setOcrRaw(result.raw ?? "");
      setOcrNote(
        "Extraction complete. Review every field; purple fields are unconfirmed model output.",
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
                Photo for {item.label} is not prepared yet. Run{" "}
                <code>node scripts/prepare-corpus.mjs</code> to convert the
                HEIC corpus into public/corpus.
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-corpus-image
              src={corpusImageUrl(item.label)}
              alt={`Job card ${item.label}`}
              className={styles.photo}
              onError={() => setPhotoMissing(true)}
            />
          )}
          <span className={styles.photoCaption}>
            {item.label} of {CORPUS.length} ({item.file})
          </span>
        </div>

        <form action={entryFormAction} className={styles.formPanel}>
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="corpus_label" value={item.label} />
          <input
            type="hidden"
            name="opened_at"
            value={new Date(openedAtMs).toISOString()}
          />
          <input type="hidden" name="client_name" value={fields.client_name} />
          <input type="hidden" name="phone_number" value={fields.phone_number} />
          <input type="hidden" name="date" value={fields.date} />
          <input type="hidden" name="date_promised" value={fields.date_promised} />
          <input type="hidden" name="instructions" value={fields.instructions} />
          <input type="hidden" name="price" value={fields.price} />
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
                disabled={busy || photoMissing}
                className={styles.button}
              >
                {busy ? "Extracting…" : "Run OCR"}
              </button>
              {ocrNote && <span className={styles.noteModel}>{ocrNote}</span>}
            </div>
          )}

          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Client name</span>
              <input
                type="text"
                value={fields.client_name}
                onChange={(e) => setField("client_name", e.target.value)}
                required
                autoComplete="off"
                className={`${styles.input} ${
                  modelFields.has("client_name") ? styles.inputModel : ""
                }`}
              />
            </label>
            <label className={styles.field}>
              <span>Phone number</span>
              <input
                type="text"
                value={fields.phone_number}
                onChange={(e) => setField("phone_number", e.target.value)}
                autoComplete="off"
                className={`${styles.input} ${styles.inputMono} ${
                  modelFields.has("phone_number") ? styles.inputModel : ""
                }`}
              />
            </label>
            <label className={styles.field}>
              <span>Date</span>
              <input
                type="text"
                inputMode="numeric"
                value={fields.date}
                onChange={(e) => setField("date", e.target.value)}
                placeholder="YYYY-MM-DD"
                className={`${styles.input} ${styles.inputMono} ${
                  modelFields.has("date") ? styles.inputModel : ""
                }`}
              />
            </label>
            <label className={styles.field}>
              <span>Date promised</span>
              <input
                type="text"
                inputMode="numeric"
                value={fields.date_promised}
                onChange={(e) => setField("date_promised", e.target.value)}
                placeholder="YYYY-MM-DD"
                className={`${styles.input} ${styles.inputMono} ${
                  modelFields.has("date_promised") ? styles.inputModel : ""
                }`}
              />
            </label>
            <label className={styles.field}>
              <span>Price</span>
              <input
                type="text"
                inputMode="decimal"
                value={fields.price}
                onChange={(e) => setField("price", e.target.value)}
                placeholder="e.g. 125.50"
                className={`${styles.input} ${styles.inputMono} ${
                  modelFields.has("price") ? styles.inputModel : ""
                }`}
              />
            </label>
            <label
              className={`${styles.field} ${styles.fieldFull}`}
            >
              <span>Instructions / article details</span>
              <textarea
                value={fields.instructions}
                onChange={(e) => setField("instructions", e.target.value)}
                rows={4}
                className={`${styles.textarea} ${
                  modelFields.has("instructions") ? styles.inputModel : ""
                }`}
              />
            </label>
          </div>

          {entryState.error && (
            <p role="alert" className={styles.alertError}>
              {entryState.error}
            </p>
          )}

          <div className={styles.actionsRow}>
            <button
              type="submit"
              disabled={entrySaving}
              className={styles.buttonGreen}
            >
              {entrySaving ? "Saving…" : "Save and next"}
            </button>
            <button
              type="button"
              onClick={restartTimer}
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
