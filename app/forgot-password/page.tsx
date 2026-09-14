"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { AuthShell } from "@/app/auth-shell";
import styles from "@/app/auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/update-password")}`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    const cookieKeys = document.cookie
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter((k) => k.includes("-code-verifier"));

    setMessage(
      cookieKeys.length > 0
        ? `If that email has an account, a password reset link has been sent. [debug] verifier cookie present: ${cookieKeys.join(", ")}`
        : "If that email has an account, a password reset link has been sent. [debug] NO verifier cookie was written in this browser",
    );
  }

  return (
    <AuthShell
      eyebrow="Password"
      title="Reset your password"
      subtitle="We&apos;ll email you a link to set a new password."
    >
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

        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className={styles.footer}>
        <Link href="/login" className={styles.link}>
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}