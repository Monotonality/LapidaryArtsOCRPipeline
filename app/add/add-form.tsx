"use client";

import { useActionState, useRef, useState } from "react";
import { createRecord } from "./actions";
import { FIELD_KEYS, type FieldKey, type CheckedFields } from "./reader";
import { PhotoReader } from "./photo-reader";
import {
  EMPTY_STATUS, STATUS_TEXT, isoToDate, statusToColumns,
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
  const [mode, setMode] = useState<Mode>("form");
  const [form, setForm] = useState<RecordFields>(EMPTY);
  const [status, setStatus] = useState<StatusMap>(EMPTY_STATUS);
  const [edited, setEdited] = useState<Set<FieldKey>>(new Set());
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
    setEdited((current) => new Set(current).add(key));
    setReviewed(false);
  }

  function setFieldStatus(key: FieldKey, next: FieldStatus) {
    setStatus((current) => ({ ...current, [key]: next }));
    setReviewed(false);
  }

  const ticks = (key: FieldKey) => (
    <FieldStatusTicks status={status[key]} onChange={(next) => setFieldStatus(key, next)} className={styles.naTick} />
  );

  function clearAll() {
    setForm(EMPTY);
    setStatus(EMPTY_STATUS);
    setEdited(new Set());
    setReviewed(false);
    setHasPhoto(false);
    setPhotoKey((key) => key + 1);
  }

  function applyModel(fields: CheckedFields) {
    setForm((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (edited.has(key)) continue;
        const value = fields[key].reviewValue ?? "";
        next[key] = key === "date" || key === "date_promised" ? isoToDate(value) : value;
      }
      return next;
    });
    setStatus((current) => {
      const next = { ...current };
      for (const key of FIELD_KEYS) {
        if (!edited.has(key) && fields[key].reviewValue) next[key] = "value";
      }
      return next;
    });
    setReviewed(false);
  }

  return (
    <div ref={stageRef} className={styles.stage}>
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
            setHasPhoto(selected); setForm(EMPTY); setStatus(EMPTY_STATUS); setEdited(new Set()); setReviewed(false);
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
              placeholder={flagText("client_name") ?? "e.g. Margaret Ellison"} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Phone number</span>
              {ticks("phone_number")}
            </span>
            <input name="phone_number" type="tel" value={na.phone_number ? "" : form.phone_number} onChange={(event) => set("phone_number", event.target.value)}
              disabled={na.phone_number} autoComplete="off"
              placeholder={flagText("phone_number") ?? "e.g. 214-555-0137"} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Date</span>
              {ticks("date")}
            </span>
            <DateInput name="date" value={na.date ? "" : form.date} onValueChange={(value) => set("date", value)}
              disabled={na.date} placeholder={flagText("date")} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Date promised</span>
              {ticks("date_promised")}
            </span>
            <DateInput name="date_promised" value={na.date_promised ? "" : form.date_promised} onValueChange={(value) => set("date_promised", value)}
              disabled={na.date_promised} placeholder={flagText("date_promised")} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Price</span>
              {ticks("price")}
            </span>
            <input name="price" type="text" inputMode="decimal" value={na.price ? "" : form.price} onChange={(event) => set("price", event.target.value)}
              disabled={na.price} autoComplete="off"
              placeholder={flagText("price") ?? "e.g. 125.50"} className={styles.input} />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>Instructions / article details</span>
              {ticks("instructions")}
            </span>
            <textarea name="instructions" value={na.instructions ? "" : form.instructions} onChange={(event) => set("instructions", event.target.value)}
              disabled={na.instructions} rows={4}
              placeholder={flagText("instructions") ?? "e.g. Ring sizing; reset two stones."} className={styles.textarea} />
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
