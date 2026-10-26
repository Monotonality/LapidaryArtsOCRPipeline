"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateRecord } from "./actions";
import {
  FIELD_KEYS,
  STATUS_TEXT,
  statusToColumns,
  type FieldKey,
  type FieldStatus,
  type StatusMap,
} from "@/lib/record-fields";
import { DateInput, FieldStatusTicks } from "@/app/field-inputs";
import styles from "@/app/add/add.module.css";

type EditFields = Record<FieldKey, string>;

export function EditRecordForm({
  recordId,
  initial,
  initialStatus,
}: {
  recordId: string;
  initial: EditFields;
  initialStatus: StatusMap;
}) {
  const [form, setForm] = useState<EditFields>(initial);
  const [status, setStatus] = useState<StatusMap>(initialStatus);
  const [state, formAction, saving] = useActionState(updateRecord, {});
  const columns = statusToColumns(status);

  function set(key: FieldKey, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const flagged = (key: FieldKey) => status[key] !== "value";
  const flagText = (key: FieldKey) =>
    flagged(key) ? STATUS_TEXT[status[key] as "na" | "invalid"] : undefined;
  const value = (key: FieldKey) => (flagged(key) ? "" : form[key]);
  const head = (key: FieldKey, label: string) => (
    <span className={styles.fieldHead}>
      <span className={styles.fieldLabel}>{label}</span>
      <FieldStatusTicks
        status={status[key]}
        onChange={(next: FieldStatus) =>
          setStatus((s) => ({ ...s, [key]: next }))
        }
        className={styles.naTick}
      />
    </span>
  );

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="id" value={recordId} />
      {FIELD_KEYS.map((key) => (
        <input key={key} type="hidden" name={key} value={value(key)} />
      ))}
      <input type="hidden" name="na_fields" value={columns.na_fields.join(",")} />
      <input
        type="hidden"
        name="invalid_fields"
        value={columns.invalid_fields.join(",")}
      />

      <div className={styles.fields}>
        <label className={styles.field}>
          {head("client_name", "Client name")}
          <input
            type="text"
            value={value("client_name")}
            onChange={(e) => set("client_name", e.target.value)}
            required={!flagged("client_name")}
            disabled={flagged("client_name")}
            autoComplete="off"
            placeholder={flagText("client_name") ?? "e.g. Margaret Ellison"}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          {head("phone_number", "Phone number")}
          <input
            type="tel"
            value={value("phone_number")}
            onChange={(e) => set("phone_number", e.target.value)}
            disabled={flagged("phone_number")}
            autoComplete="off"
            placeholder={flagText("phone_number") ?? "e.g. 214-555-0137"}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          {head("date", "Date")}
          <DateInput
            value={value("date")}
            onValueChange={(v) => set("date", v)}
            disabled={flagged("date")}
            placeholder={flagText("date")}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          {head("date_promised", "Date promised")}
          <DateInput
            value={value("date_promised")}
            onValueChange={(v) => set("date_promised", v)}
            disabled={flagged("date_promised")}
            placeholder={flagText("date_promised")}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          {head("price", "Price")}
          <input
            type="text"
            inputMode="decimal"
            value={value("price")}
            onChange={(e) => set("price", e.target.value)}
            disabled={flagged("price")}
            autoComplete="off"
            placeholder={flagText("price") ?? "e.g. 125.50"}
            className={styles.input}
          />
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          {head("instructions", "Instructions / article details")}
          <textarea
            value={value("instructions")}
            onChange={(e) => set("instructions", e.target.value)}
            disabled={flagged("instructions")}
            rows={4}
            placeholder={
              flagText("instructions") ?? "e.g. Ring sizing; reset two stones."
            }
            className={styles.textarea}
          />
        </label>
      </div>

      {state.error && (
        <p role="alert" className={styles.alertError}>
          {state.error}
        </p>
      )}

      <div className={styles.formActions}>
        <button
          type="submit"
          disabled={saving}
          className={styles.saveButton}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <Link href="/dashboard" className={styles.clearButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
