"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/app/auth-shell";
import styles from "@/app/auth.module.css";

type SessionState = "checking" | "ready" | "expired";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSessionState(data.session ? "ready" : "expired");
      })
      .catch(() => {
        if (cancelled) return;
        setSessionState("expired");
      });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
      setSessionState("expired");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?status=password-updated");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Password"
      title="Reset your password"
      subtitle="Pick a strong password, then sign back in with it."
    >
      {sessionState === "checking" && (
        <p className={styles.subtitle}>Checking your link…</p>
      )}

      {sessionState === "expired" && (
        <>
          <div role="alert" className={styles.alertError}>
            That password reset link is invalid or has expired.
          </div>
          <p className={styles.footer}>
            <Link href="/forgot-password" className={styles.link}>
              Request a new reset link
            </Link>
          </p>
        </>
      )}

      {sessionState === "ready" && (
        <>
          {error && (
            <div role="alert" className={styles.alertError}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
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

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>

          <p className={styles.footer}>
            <Link href="/login" className={styles.link}>
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}