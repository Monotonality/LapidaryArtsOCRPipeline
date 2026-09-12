"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(
      "If that email has an account, a password reset link has been sent.",
    );
  }

  return (
    <main className={styles.auth}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.subtitle}>
          We'll email you a link to set a new password.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.message}>{message}</p>}

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className={styles.footer}>
          <Link href="/login" className={styles.link}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}