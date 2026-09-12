"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/auth.module.css";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?status=password-updated");
    router.refresh();
  }

  return (
    <main className={styles.auth}>
      <div className={styles.card}>
        <h1 className={styles.title}>Set a new password</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className={styles.input}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Updating..." : "Update password"}
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