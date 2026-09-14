"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateRecord } from "./actions";
import styles from "@/app/add/add.module.css";

type EditFields = {
  client_name: string;
  phone_number: string;
  date: string;
  date_promised: string;
  instructions: string;
  price: string;
};

export function EditRecordForm({ recordId, initial }: { recordId: string; initial: EditFields }) {
  const [form, setForm] = useState<EditFields>(initial);
  const [state, formAction, saving] = useActionState(updateRecord, {});

  function set<K extends keyof EditFields>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="id" value={recordId} />
      <input type="hidden" name="client_name" value={form.client_name} />
      <input type="hidden" name="phone_number" value={form.phone_number} />
      <input type="hidden" name="date" value={form.date} />
      <input type="hidden" name="date_promised" value={form.date_promised} />
      <input type="hidden" name="instructions" value={form.instructions} />
      <input type="hidden" name="price" value={form.price} />

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Client name</span>
          <input
            type="text"
            value={form.client_name}
            onChange={(e) => set("client_name", e.target.value)}
            required
            autoComplete="off"
            placeholder="e.g. Margaret Ellison"
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Phone number</span>
          <input
            type="tel"
            value={form.phone_number}
            onChange={(e) => set("phone_number", e.target.value)}
            autoComplete="off"
            placeholder="e.g. 214-555-0137"
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Date promised</span>
          <input
            type="date"
            value={form.date_promised}
            onChange={(e) => set("date_promised", e.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Price</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            autoComplete="off"
            placeholder="e.g. 125.50"
            className={styles.input}
          />
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>
            Instructions / article details
          </span>
          <textarea
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            rows={4}
            placeholder="e.g. Ring sizing; reset two stones."
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