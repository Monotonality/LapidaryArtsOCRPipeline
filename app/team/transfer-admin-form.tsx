"use client";

import { useActionState, useState } from "react";
import { transferAdminRole, type MemberStatusState } from "./actions";
import styles from "./team.module.css";

type MemberRef = { id: string; email: string };

export function TransferAdminForm({ members }: { members: MemberRef[] }) {
  const [state, formAction, pending] = useActionState<
    MemberStatusState,
    FormData
  >(transferAdminRole, {});
  const [selected, setSelected] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  if (members.length === 0) {
    return (
      <p className={styles.empty}>
        Add another member before you can transfer the admin role.
      </p>
    );
  }

  return (
    <form action={formAction} className={styles.addForm}>
      {state?.error && (
        <div role="alert" className={styles.alertError}>
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className={styles.alertSuccess}>
          {state.success}
        </div>
      )}

      <div className={styles.addFields}>
        <label className={styles.label}>
          New admin
          <select
            name="member_id"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setConfirmEmail("");
            }}
            required
            className={styles.input}
          >
            <option value="" disabled>
              Select a member…
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Type their email to confirm
          <input
            type="email"
            name="confirm_email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="you@example.com"
            className={styles.input}
          />
        </label>

        <button type="submit" disabled={pending} className={styles.addButton}>
          {pending ? "Transferring…" : "Transfer admin role"}
        </button>
      </div>
    </form>
  );
}