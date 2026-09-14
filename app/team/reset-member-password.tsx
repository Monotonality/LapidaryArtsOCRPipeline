"use client";

import { useActionState, useState } from "react";
import { resetMemberPassword, type MemberStatusState } from "./actions";
import styles from "./team.module.css";

export function ResetMemberPassword({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    MemberStatusState,
    FormData
  >(resetMemberPassword.bind(null, userId, email), {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.resetPassword}
      >
        Reset password
      </button>
    );
  }

  return (
    <div className={styles.resetWrap}>
      {state?.error && (
        <span role="alert" className={styles.alertInline}>
          {state.error}
        </span>
      )}
      {state?.success && (
        <span role="status" className={styles.alertSuccessInline}>
          {state.success}
        </span>
      )}
      <form action={formAction} className={styles.resetForm}>
        <input
          type="password"
          name="password"
          minLength={6}
          required
          placeholder="New temp password"
          className={styles.input}
        />
        <input
          type="password"
          name="confirm"
          minLength={6}
          required
          placeholder="Repeat it"
          className={styles.input}
        />
        <button type="submit" disabled={pending} className={styles.addButton}>
          {pending ? "Saving…" : "Set"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={styles.cancelReset}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}