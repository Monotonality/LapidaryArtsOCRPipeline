"use client";

import { useActionState, useState } from "react";
import { createRecord } from "./actions";
import { FIELD_KEYS, type FieldKey, type Rect, type Suggestions } from "./field-mapper";
import type { CheckedFields } from "./ollama";
import { PhotoReader, type Evidence } from "./photo-reader";
import styles from "./add.module.css";

type Mode = "form" | "photo";
type RecordFields = Record<FieldKey, string>;
type EvidenceMap = Partial<Record<FieldKey, Evidence>>;

const EMPTY: RecordFields = {
  client_name: "", phone_number: "", date: "", date_promised: "", instructions: "", price: "",
};

function FieldSource({ source, onAccept }: { source?: Evidence; onAccept?: () => void }) {
  if (!source) return null;
  return (
    <div className={styles.fieldSource}>
      {source.preview && <img src={source.preview} alt="Selected source text" className={styles.sourcePreview} />}
      <span>
        {source.suggestion ? (
          <>
            <strong>{source.source === "paddle" ? "Paddle suggestion" : "Model suggestion"}:</strong> {source.suggestion}<br />
            <strong>Evidence:</strong> {source.raw || "None"}<br />
            {source.confidence && <><strong>Confidence:</strong> {source.confidence} · </>}{source.reason ?? "Filled for review"}
          </>
        ) : <>Read: {source.raw || "No text recognized"}</>}
      </span>
      {source.suggestion && source.reason && source.acceptValue && onAccept && (
        <button type="button" onClick={onAccept} className={styles.suggestionButton}>Use suggestion</button>
      )}
    </div>
  );
}

export function AddRecord({ demo = false }: { demo?: boolean }) {
  const [mode, setMode] = useState<Mode>("form");
  const [form, setForm] = useState<RecordFields>(EMPTY);
  const [evidence, setEvidence] = useState<EvidenceMap>({});
  const [edited, setEdited] = useState<Set<FieldKey>>(new Set());
  const [reviewed, setReviewed] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const [state, formAction, saving] = useActionState(createRecord, {});

  function set(key: FieldKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setEdited((current) => new Set(current).add(key));
    setReviewed(false);
  }

  function clearAll() {
    setForm(EMPTY);
    setEvidence({});
    setEdited(new Set());
    setReviewed(false);
    setHasPhoto(false);
    setPhotoKey((key) => key + 1);
  }

  function applyAuto(suggestions: Suggestions, sources: EvidenceMap) {
    setEvidence((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (edited.has(key) || current[key]?.source === "ollama" || current[key]?.source === "openrouter") continue;
        const item = suggestions[key];
        if (sources[key] && item?.value) next[key] = {
          ...sources[key], source: "paddle", suggestion: item.value,
          acceptValue: item.value, reason: "PaddleOCR requires staff review",
        };
      }
      return next;
    });
    setReviewed(false);
  }

  function applyField(key: FieldKey, value: string, source: Evidence) {
    setForm((current) => ({ ...current, [key]: value }));
    setEvidence((current) => ({ ...current, [key]: source }));
    setEdited((current) => new Set(current).add(key));
    setReviewed(false);
  }

  function applyModel(fields: CheckedFields, source: "ollama" | "openrouter") {
    setEvidence((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (edited.has(key)) continue;
        const item = fields[key];
        next[key] = {
          source,
          raw: item.evidence ?? "",
          suggestion: item.value ?? undefined,
          acceptValue: item.reviewValue ?? undefined,
          confidence: item.confidence,
          reason: item.reason,
        };
      }
      return next;
    });
    setForm((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (!edited.has(key)) next[key] = fields[key].filledValue ?? "";
      }
      return next;
    });
    setReviewed(false);
  }

  function acceptSuggestion(key: FieldKey) {
    const source = evidence[key];
    if (!source?.acceptValue) return;
    setForm((current) => ({ ...current, [key]: source.acceptValue! }));
    setEvidence((current) => ({ ...current, [key]: { ...source, reason: null } }));
    setEdited((current) => new Set(current).add(key));
    setReviewed(false);
  }

  const sourceRects: Partial<Record<FieldKey, Rect>> = {};
  for (const key of FIELD_KEYS) {
    if (evidence[key]?.rect) sourceRects[key] = evidence[key].rect;
  }

  return (
    <div className={styles.stage}>
      <div className={styles.tabs} role="tablist" aria-label="Add a record">
        <button type="button" role="tab" aria-selected={mode === "form"}
          onClick={() => setMode("form")} className={mode === "form" ? styles.tabActive : styles.tab}>Form</button>
        <button type="button" role="tab" aria-selected={mode === "photo"}
          onClick={() => setMode("photo")} className={mode === "photo" ? styles.tabActive : styles.tab}>Photo</button>
      </div>

      <div className={styles.photoWrapper} hidden={mode !== "photo"}>
        <PhotoReader key={photoKey} onPhotoChange={(selected) => {
          setHasPhoto(selected); setForm(EMPTY); setEvidence({}); setEdited(new Set()); setReviewed(false);
        }} onAuto={applyAuto} onModel={applyModel} onField={applyField} sourceRects={sourceRects} demo={demo} />
      </div>

      <form action={demo ? undefined : formAction} onSubmit={demo ? (event) => event.preventDefault() : undefined} className={styles.form}>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Client name</span>
            <input name="client_name" type="text" value={form.client_name} onChange={(event) => set("client_name", event.target.value)}
              required autoComplete="off" placeholder="e.g. Margaret Ellison" className={styles.input} />
            <FieldSource source={evidence.client_name} onAccept={() => acceptSuggestion("client_name")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Phone number</span>
            <input name="phone_number" type="tel" value={form.phone_number} onChange={(event) => set("phone_number", event.target.value)}
              autoComplete="off" placeholder="e.g. 214-555-0137" className={styles.input} />
            <FieldSource source={evidence.phone_number} onAccept={() => acceptSuggestion("phone_number")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date</span>
            <input name="date" type="date" value={form.date} onChange={(event) => set("date", event.target.value)} className={styles.input} />
            <FieldSource source={evidence.date} onAccept={() => acceptSuggestion("date")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date promised</span>
            <input name="date_promised" type="date" value={form.date_promised} onChange={(event) => set("date_promised", event.target.value)} className={styles.input} />
            <FieldSource source={evidence.date_promised} onAccept={() => acceptSuggestion("date_promised")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Price</span>
            <input name="price" type="text" inputMode="decimal" value={form.price} onChange={(event) => set("price", event.target.value)}
              autoComplete="off" placeholder="e.g. 125.50" className={styles.input} />
            <FieldSource source={evidence.price} onAccept={() => acceptSuggestion("price")} />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Instructions / article details</span>
            <textarea name="instructions" value={form.instructions} onChange={(event) => set("instructions", event.target.value)}
              rows={4} placeholder="e.g. Ring sizing; reset two stones." className={styles.textarea} />
            <FieldSource source={evidence.instructions} onAccept={() => acceptSuggestion("instructions")} />
          </label>
        </div>

        {hasPhoto && (
          <label className={styles.reviewConfirm}>
            <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} required />
            <span>I checked these values against the photo.</span>
          </label>
        )}

        {state.error && <p role="alert" className={styles.alertError}>{state.error}</p>}
        {demo && <p className={styles.ocrNote}>Local demo: OCR and review work here. Saving needs the app&apos;s Supabase settings.</p>}
        <div className={styles.formActions}>
          {demo ? (
            <button type="button" disabled className={styles.saveButton}>Save unavailable in demo</button>
          ) : (
            <button type="submit" disabled={saving || (hasPhoto && !reviewed)} className={styles.saveButton}>
              {saving ? "Saving…" : "Save record"}
            </button>
          )}
          <button type="button" onClick={clearAll} className={styles.clearButton}>Clear</button>
        </div>
      </form>
    </div>
  );
}
