"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/app/auth-shell";
import styles from "@/app/auth.module.css";

type Params = {
  tokenHash: string;
  type: EmailOtpType;
  next: string;
};

type State = "reading" | "ready" | "verifying" | "done" | "missing" | "error";

export default function ConfirmPasswordPage() {
  const router = useRouter();
  const [params, setParams] = useState<Params | null>(null);
  const [state, setState] = useState<State>("reading");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const tokenHash = search.get("token_hash");
    const type = (search.get("type") ?? "recovery") as EmailOtpType;
    const next = search.get("next") ?? "/update-password";

    if (!tokenHash) {
      setState("missing");
      return;
    }

    setParams({ tokenHash, type, next });
    setState("ready");
  }, []);

  async function handleContinue() {
    if (!params || state === "verifying") return;
    setLoading(true);
    setError(null);
    setState("verifying");

    // The token is only consumed here, on an explicit user click. A scanner
    // that prefetches this page just reads HTML and never verifies the OTP.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: params.type,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      setState("error");
      return;
    }

    setState("done");
    const dest = params.next.startsWith("/") ? params.next : `/${params.next}`;
    router.replace(dest);
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Password"
      title="Finish resetting your password"
      subtitle="Confirm this request, then you'll be able to choose a new password."
    >
      {state === "reading" && (
        <p className={styles.subtitle}>Checking your link…</p>
      )}

      {state === "missing" && (
        <>
          <div role="alert" className={styles.alertError}>
            This link is missing a valid token. It may be truncated or out of
            date. Request a new reset link instead.
          </div>
          <p className={styles.footer}>
            <a href="/forgot-password" className={styles.link}>
              Request a new reset link
            </a>
          </p>
        </>
      )}

      {state === "error" && (
        <>
          <div role="alert" className={styles.alertError}>
            {error ?? "That link is invalid or has expired."}
          </div>
          <p className={styles.footer}>
            <a href="/forgot-password" className={styles.link}>
              Request a new reset link
            </a>
          </p>
        </>
      )}

      {(state === "ready" || state === "verifying") && (
        <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className={styles.form}>
          <button
            type="submit"
            disabled={loading}
            className={styles.button}
          >
            {loading ? "Verifying…" : "Continue"}
          </button>
          <p className={styles.footer}>
            <a href="/login" className={styles.link}>
              Back to sign in
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  );
}