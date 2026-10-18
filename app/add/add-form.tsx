"use client";

import { useActionState, useState } from "react";
import { createRecord } from "./actions";
import { FIELD_KEYS, type FieldKey, type CheckedFields } from "./reader";
import { PhotoReader, type Evidence } from "./photo-reader";
import styles from "./add.module.css";

type Mode = "form" | "photo";
type RecordFields = Record<FieldKey, string>;
type EvidenceMap = Partial<Record<FieldKey, Evidence>>;
type NaMap = Record<FieldKey, boolean>;

const EMPTY: RecordFields = {
  client_name: "", phone_number: "", date: "", date_promised: "", instructions: "", price: "",
};

const NO_NA: NaMap = {
  client_name: false, phone_number: false, date: false,
  date_promised: false, instructions: false, price: false,
};

function FieldSource({ source, onAccept }: { source?: Evidence; onAccept?: () => void }) {
  if (!source) return null;
  return (
    <div className={styles.fieldSource}>
      <span>
        {source.suggestion ? (
          <>
            <strong>Model suggestion:</strong> {source.suggestion}<br />
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
  const [na, setNa] = useState<NaMap>(NO_NA);
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

  function toggleNa(key: FieldKey) {
    setNa((current) => ({ ...current, [key]: !current[key] }));
    setReviewed(false);
  }

  function clearAll() {
    setForm(EMPTY);
    setNa(NO_NA);
    setEvidence({});
    setEdited(new Set());
    setReviewed(false);
    setHasPhoto(false);
    setPhotoKey((key) => key + 1);
  }

  function applyModel(fields: CheckedFields) {
    setEvidence((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (edited.has(key)) continue;
        const item = fields[key];
        next[key] = {
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
    setNa((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (!edited.has(key) && fields[key].filledValue) next[key] = false;
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
    setNa((current) => ({ ...current, [key]: false }));
    setReviewed(false);
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
        <PhotoReader
          key={photoKey}
          onPhotoChange={(selected) => {
            setHasPhoto(selected); setForm(EMPTY); setNa(NO_NA); setEvidence({}); setEdited(new Set()); setReviewed(false);
          }}
          onModel={applyModel}
          demo={demo}
        />
      </div>

      <form action={demo ? undefined : formAction} onSubmit={demo ? (event) => event.preventDefault() : undefined} className={styles.form}>
        {na.client_name && <input type="hidden" name="client_name" value="N/A" />}
        {na.phone_number && <input type="hidden" name="phone_number" value="N/A" />}
        {na.date && <input type="hidden" name="date" value="N/A" />}
        {na.date_promised && <input type="hidden" name="date_promised" value="N/A" />}
        {na.instructions && <input type="hidden" name="instructions" value="N/A" />}
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Client name</span>
              <span className={styles.naTick}>
                <input type="checkbox" checked={na.client_name} onChange={() => toggleNa("client_name")} />
                N/A
              </span>
            </span>
            <input name="client_name" type="text" value={na.client_name ? "" : form.client_name} onChange={(event) => set("client_name", event.target.value)}
              required={!na.client_name} disabled={na.client_name} autoComplete="off"
              placeholder={na.client_name ? "N/A" : "e.g. Margaret Ellison"} className={styles.input} />
            <FieldSource source={evidence.client_name} onAccept={() => acceptSuggestion("client_name")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Phone number</span>
              <span className={styles.naTick}>
                <input type="checkbox" checked={na.phone_number} onChange={() => toggleNa("phone_number")} />
                N/A
              </span>
            </span>
            <input name="phone_number" type="tel" value={na.phone_number ? "" : form.phone_number} onChange={(event) => set("phone_number", event.target.value)}
              disabled={na.phone_number} autoComplete="off"
              placeholder={na.phone_number ? "N/A" : "e.g. 214-555-0137"} className={styles.input} />
            <FieldSource source={evidence.phone_number} onAccept={() => acceptSuggestion("phone_number")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Date</span>
              <span className={styles.naTick}>
                <input type="checkbox" checked={na.date} onChange={() => toggleNa("date")} />
                N/A
              </span>
            </span>
            <input name="date" type="date" value={na.date ? "" : form.date} onChange={(event) => set("date", event.target.value)}
              disabled={na.date} className={styles.input} />
            <FieldSource source={evidence.date} onAccept={() => acceptSuggestion("date")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Date promised</span>
              <span className={styles.naTick}>
                <input type="checkbox" checked={na.date_promised} onChange={() => toggleNa("date_promised")} />
                N/A
              </span>
            </span>
            <input name="date_promised" type="date" value={na.date_promised ? "" : form.date_promised} onChange={(event) => set("date_promised", event.target.value)}
              disabled={na.date_promised} className={styles.input} />
            <FieldSource source={evidence.date_promised} onAccept={() => acceptSuggestion("date_promised")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Price</span>
              <span className={styles.naTick}>
                <input type="checkbox" checked={na.price} onChange={() => toggleNa("price")} />
                N/A
              </span>
            </span>
            <input name="price" type="text" inputMode="decimal" value={na.price ? "" : form.price} onChange={(event) => set("price", event.target.value)}
              disabled={na.price} autoComplete="off"
              placeholder={na.price ? "N/A" : "e.g. 125.50"} className={styles.input} />
            <FieldSource source={evidence.price} onAccept={() => acceptSuggestion("price")} />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Instructions / article details</span>
              <span className={styles.naTick}>
                <input type="checkbox" checked={na.instructions} onChange={() => toggleNa("instructions")} />
                N/A
              </span>
            </span>
            <textarea name="instructions" value={na.instructions ? "" : form.instructions} onChange={(event) => set("instructions", event.target.value)}
              disabled={na.instructions} rows={4}
              placeholder={na.instructions ? "N/A" : "e.g. Ring sizing; reset two stones."} className={styles.textarea} />
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
        {demo && <p className={styles.ocrNote}>Local demo: AI OCR and review work here. Saving needs the app&apos;s Supabase settings.</p>}
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
