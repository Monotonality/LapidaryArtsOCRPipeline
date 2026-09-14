"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./team.module.css";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setPassword("");
    setConfirm("");
    setMessage("Password updated.");
  }

  return (
    <form onSubmit={handleSubmit} className={styles.addForm}>
      {error && (
        <div role="alert" className={styles.alertError}>
          {error}
        </div>
      )}
      {message && (
        <div role="status" className={styles.alertSuccess}>
          {message}
        </div>
      )}

      <div className={styles.addFields}>
        <label className={styles.label}>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            placeholder="At least 6 characters"
            className={styles.input}
          />
        </label>

        <label className={styles.label}>
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            placeholder="Repeat your new password"
            className={styles.input}
          />
        </label>

        <button type="submit" disabled={loading} className={styles.addButton}>
          {loading ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}