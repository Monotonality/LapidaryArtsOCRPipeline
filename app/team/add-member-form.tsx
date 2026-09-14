"use client";

import { useActionState, useState } from "react";
import { addMember, type MemberStatusState } from "./actions";
import styles from "./team.module.css";

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState<
    MemberStatusState,
    FormData
  >(addMember, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className={styles.addForm}>
      {state?.error && (
        <div role="alert" className={styles.alertError}>
          {state.error}
        </div>
      )}

      <div className={styles.addFields}>
        <label className={styles.label}>
          Email
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="you@example.com"
            className={styles.input}
          />
        </label>

        <label className={styles.label}>
          Temporary password
          <input
            type="text"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="off"
            placeholder="At least 6 characters"
            className={styles.input}
          />
        </label>

        <button type="submit" disabled={pending} className={styles.addButton}>
          {pending ? "Adding…" : "Add member"}
        </button>
      </div>

      <p className={styles.hint}>
        Share the password out of band. The new member can change it after
        signing in.
      </p>
    </form>
  );
}