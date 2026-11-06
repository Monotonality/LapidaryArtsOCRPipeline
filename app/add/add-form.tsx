"use client";

import { useActionState, useRef, useState } from "react";
import { createRecord } from "./actions";
import { FIELD_KEYS, type FieldKey, type CheckedFields } from "./reader";
import { PhotoReader } from "./photo-reader";
import {
  EMPTY_STATUS, PROMISED_MAX_LENGTH, PROMISED_PLACEHOLDER, STATUS_TEXT, isoToDate, normalizeDate,
  promisedSummary, statusToColumns,
  type FieldStatus, type StatusMap,
} from "@/lib/record-fields";
import { DateInput, FieldStatusTicks, useKeepScrollWhileTyping } from "@/app/field-inputs";
import styles from "./add.module.css";

type Mode = "form" | "photo";
type RecordFields = Record<FieldKey, string>;

const EMPTY: RecordFields = {
  client_name: "", phone_number: "", date: "", date_promised: "", instructions: "", price: "",
};

export function AddRecord({ demo = false }: { demo?: boolean }) {
  const [mode, setMode] = useState<Mode>("photo");
  const [form, setForm] = useState<RecordFields>(EMPTY);
  const [status, setStatus] = useState<StatusMap>(EMPTY_STATUS);
  const [edited, setEditedState] = useState<Set<FieldKey>>(new Set());
  // applyModel runs when an AI read finishes, from a closure made when it
  // started; the ref sees fields typed into while the read was running.
  const editedRef = useRef<Set<FieldKey>>(new Set());
  const setEdited = (next: Set<FieldKey>) => {
    editedRef.current = next;
    setEditedState(next);
  };
  const markEdited = (key: FieldKey) => setEdited(new Set(editedRef.current).add(key));
  const [ocr, setOcr] = useState<CheckedFields | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const [state, formAction, saving] = useActionState(createRecord, {});
  const stageRef = useRef<HTMLDivElement>(null);
  useKeepScrollWhileTyping(stageRef);
  const na = Object.fromEntries(FIELD_KEYS.map((key) => [key, status[key] !== "value"])) as Record<FieldKey, boolean>;
  const flagText = (key: FieldKey) => status[key] === "value" ? undefined : STATUS_TEXT[status[key] as "na" | "invalid"];
  const columns = statusToColumns(status);

  function set(key: FieldKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    markEdited(key);
    setReviewed(false);
  }

  function setFieldStatus(key: FieldKey, next: FieldStatus) {
    setStatus((current) => ({ ...current, [key]: next }));
    // A ticked N/A or Invalid is a staff decision; a later AI read keeps it.
    markEdited(key);
    setReviewed(false);
  }

  const ticks = (key: FieldKey) => (
    <FieldStatusTicks status={status[key]} onChange={(next) => setFieldStatus(key, next)} className={styles.naTick} />
  );

  // What the AI read says about a field, until staff edit it.
  const ocrField = (key: FieldKey) => (ocr && !edited.has(key) ? ocr[key] : null);
  const needsCheck = (key: FieldKey) => {
    const field = ocrField(key);
    return Boolean(field && status[key] === "value" &&
      (field.presence === "unreadable" || field.issues.length > 0));
  };
  const inputClass = (key: FieldKey, base: string) => needsCheck(key) ? `${base} ${styles.inputCheck}` : base;

  function hint(key: FieldKey) {
    const field = ocrField(key);
    if (!field) return null;
    if (field.presence === "blank") {
      return status[key] === "na"
        ? <span className={styles.hint}>Blank on the card, so marked N/A. Untick if that&apos;s wrong.</span>
        : null;
    }
    if (!needsCheck(key)) return null;
    if (field.presence === "unreadable") {
      return <span className={styles.hintCheck}>AI couldn&apos;t read this. Check the photo.</span>;
    }
    return (
      <span className={styles.hintCheck}>
        Check: {field.issues.join("; ")}.{field.evidence ? ` AI quoted: ${field.evidence}` : ""}
      </span>
    );
  }

  const promisedNote = status.date_promised === "value"
    ? promisedSummary(form.date_promised, status.date === "value" ? form.date : "")
    : null;

  function clearAll() {
    setForm(EMPTY);
    setStatus(EMPTY_STATUS);
    setEdited(new Set());
    setOcr(null);
    setReviewed(false);
    setHasPhoto(false);
    setPhotoKey((key) => key + 1);
  }

  function applyModel(fields: CheckedFields) {
    const edited = editedRef.current;
    setOcr(fields);
    setForm((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (edited.has(key)) continue;
        const value = fields[key].reviewValue ?? "";
        next[key] = key === "date" ? isoToDate(value)
          : key === "date_promised" ? normalizeDate(value) ?? value
            : value;
      }
      return next;
    });
    setStatus((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (edited.has(key)) continue;
        if (fields[key].reviewValue) next[key] = "value";
        // The box is empty on the card: say so instead of leaving a silent blank.
        else if (fields[key].presence === "blank") next[key] = "na";
      }
      return next;
    });
    setReviewed(false);
  }

  return (
    <div ref={stageRef} className={styles.stage}>
      <div className={styles.tabs} role="tablist" aria-label="Add a record">
        <button type="button" role="tab" aria-selected={mode === "photo"}
          onClick={() => setMode("photo")} className={mode === "photo" ? styles.tabActive : styles.tab}>Photo</button>
        <button type="button" role="tab" aria-selected={mode === "form"}
          onClick={() => setMode("form")} className={mode === "form" ? styles.tabActive : styles.tab}>Form</button>
      </div>

      <div className={styles.photoWrapper} hidden={mode !== "photo"}>
        <PhotoReader
          key={photoKey}
          onPhotoChange={(selected) => {
            setHasPhoto(selected); setForm(EMPTY); setStatus(EMPTY_STATUS); setEdited(new Set()); setOcr(null); setReviewed(false);
          }}
          onModel={applyModel}
          demo={demo}
        />
      </div>

      <form action={demo ? undefined : formAction} onSubmit={demo ? (event) => event.preventDefault() : undefined} className={styles.form}>
        <input type="hidden" name="na_fields" value={columns.na_fields.join(",")} />
        <input type="hidden" name="invalid_fields" value={columns.invalid_fields.join(",")} />
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Client name</span>
              {ticks("client_name")}
            </span>
            <input name="client_name" type="text" value={na.client_name ? "" : form.client_name} onChange={(event) => set("client_name", event.target.value)}
              required={!na.client_name} disabled={na.client_name} autoComplete="off"
              placeholder={flagText("client_name") ?? "e.g. Margaret Ellison"} className={inputClass("client_name", styles.input)} />
            {hint("client_name")}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Phone number</span>
              {ticks("phone_number")}
            </span>
            <input name="phone_number" type="tel" value={na.phone_number ? "" : form.phone_number} onChange={(event) => set("phone_number", event.target.value)}
              disabled={na.phone_number} autoComplete="off"
              placeholder={flagText("phone_number") ?? "e.g. 214-555-0137"} className={inputClass("phone_number", styles.input)} />
            {hint("phone_number")}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Date</span>
              {ticks("date")}
            </span>
            <DateInput name="date" value={na.date ? "" : form.date} onValueChange={(value) => set("date", value)}
              disabled={na.date} placeholder={flagText("date")} className={inputClass("date", styles.input)} />
            {hint("date")}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Date promised</span>
              {ticks("date_promised")}
            </span>
            <input name="date_promised" type="text" value={na.date_promised ? "" : form.date_promised}
              onChange={(event) => set("date_promised", event.target.value)}
              disabled={na.date_promised} autoComplete="off" maxLength={PROMISED_MAX_LENGTH}
              placeholder={flagText("date_promised") ?? PROMISED_PLACEHOLDER} className={inputClass("date_promised", styles.input)} />
            {hint("date_promised")}
            {promisedNote && <span className={styles.hint}>{promisedNote}</span>}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Price</span>
              {ticks("price")}
            </span>
            <input name="price" type="text" inputMode="decimal" value={na.price ? "" : form.price} onChange={(event) => set("price", event.target.value)}
              disabled={na.price} autoComplete="off"
              placeholder={flagText("price") ?? "e.g. 125.50"} className={inputClass("price", styles.input)} />
            {hint("price")}
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Instructions / article details</span>
              {ticks("instructions")}
            </span>
            <textarea name="instructions" value={na.instructions ? "" : form.instructions} onChange={(event) => set("instructions", event.target.value)}
              disabled={na.instructions} rows={4}
              placeholder={flagText("instructions") ?? "e.g. Ring sizing; reset two stones."} className={inputClass("instructions", styles.textarea)} />
            {hint("instructions")}
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
