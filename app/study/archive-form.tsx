"use client";

import { useActionState } from "react";
import { createStudyArchive } from "./actions";
import styles from "./study.module.css";

export function ArchiveForm() {
  const [state, formAction, pending] = useActionState(createStudyArchive, {});

  return (
    <form action={formAction} className={styles.actionsRow}>
      <label className={styles.field}>
        <span>Archive label (optional)</span>
        <input
          type="text"
          name="label"
          placeholder="e.g. mid-study-checkpoint"
          autoComplete="off"
          className={styles.input}
        />
      </label>
      <button type="submit" disabled={pending} className={styles.buttonGreen}>
        {pending ? "Archiving…" : "Archive dataset snapshot"}
      </button>
      {state.error && (
        <p role="alert" className={styles.alertError}>
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className={styles.alertSuccess}>Snapshot archived.</p>
      )}
    </form>
  );
}
