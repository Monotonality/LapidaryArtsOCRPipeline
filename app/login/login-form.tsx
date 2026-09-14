"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/app/auth-shell";
import styles from "@/app/auth.module.css";

const STATUS_KINDS: Record<string, "ok" | "bad"> = {
  deleted: "bad",
  error: "bad",
  "password-updated": "ok",
};

const STATUS_MESSAGES: Record<string, string> = {
  deleted: "This account has been deactivated. Contact a team member to restore access.",
  error: "That link was invalid or expired. Try again.",
  "password-updated": "Password updated. Sign in with your new password.",
};

export default function LoginForm({
  status,
  reason,
  details,
}: {
  status?: string;
  reason?: string;
  details?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const user = data.user;

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "deleted") {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        "This account has been deactivated. Contact a team member to restore access.",
      );
      return;
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  const statusKind = status ? (STATUS_KINDS[status] ?? "bad") : null;

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Open the ledger"
      subtitle="Use your Lapidary Arts login to reach the shared records."
    >
      {statusKind && STATUS_MESSAGES[status!] && (
        <div
          role="alert"
          className={
            statusKind === "ok" ? styles.alertSuccess : styles.alertError
          }
        >
          {STATUS_MESSAGES[status!]}
          {reason &&
            (status === "error" ? (
              <span className={styles.debugReason}>
                <br />
                [debug] {reason}
                {details ? ` · ${details}` : ""}
              </span>
            ) : null)}
        </div>
      )}
      {error && (
        <div role="alert" className={styles.alertError}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={styles.input}
          />
        </label>

        <label className={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={styles.input}
          />
        </label>

        <div className={styles.linkRow}>
          <span />
          <Link href="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}