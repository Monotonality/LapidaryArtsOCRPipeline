"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "./actions";
import styles from "./settings.module.css";

export function DeleteAccountButton() {
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState<
    { error?: string } | undefined
  >(async () => deleteAccount(), undefined);

  if (state?.error) {
    return (
      <div role="alert" className={styles.alertError}>
        {state.error}
      </div>
    );
  }

  if (!confirmed) {
    return (
      <button
        type="button"
        onClick={() => setConfirmed(true)}
        disabled={pending}
        className={styles.deleteButton}
      >
        Deactivate my account
      </button>
    );
  }

  return (
    <div className={styles.confirmWrap}>
      <form action={formAction}>
        <button type="submit" disabled={pending} className={styles.confirmButton}>
          {pending ? "Deleting…" : "Confirm — this can't be undone"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirmed(false)}
        disabled={pending}
        className={styles.cancelButton}
      >
        Cancel
      </button>
    </div>
  );
}