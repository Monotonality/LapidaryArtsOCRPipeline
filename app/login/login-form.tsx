"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/auth.module.css";

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Your account is pending approval by an existing team member.",
  rejected: "Your account was not approved. Contact a team member.",
  error: "That link was invalid or expired. Try again.",
  "password-updated": "Password updated. Sign in with your new password.",
};

export default function LoginForm({ status }: { status?: string }) {
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

    const { count: approvedCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");

    const isApproved =
      approvedCount && approvedCount > 0
        ? profile?.status === "approved"
        : true;

    if (!isApproved) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        "Your account is pending approval by an existing team member.",
      );
      return;
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className={styles.auth}>
      <div className={styles.card}>
        <h1 className={styles.title}>Lapidary Arts Records</h1>
        <p className={styles.subtitle}>Sign in to access the dashboard.</p>

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

          <label className={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
            />
          </label>

          <Link href="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>

          {status && STATUS_MESSAGES[status] && (
            <p className={styles.message}>{STATUS_MESSAGES[status]}</p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className={styles.footer}>
          No account?{" "}
          <Link href="/signup" className={styles.link}>
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}