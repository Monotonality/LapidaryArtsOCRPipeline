"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/app/auth-shell";

const FLOW_ID_PARAMS = ["sb_flow_id", "flow_id"];
const PKCE_VERIFIER_ERROR = "AuthPKCECodeVerifierMissingError";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") ?? "/dashboard";
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") ?? "recovery") as EmailOtpType;
    const linkError = params.get("error_description");

    function returnWith(reason: string, details?: string) {
      if (cancelled) return;
      const q = new URLSearchParams({ status: "error", reason });
      if (details) q.set("details", details);
      router.replace(`/login?${q.toString()}`);
      router.refresh();
    }

    function stripFlowIdFromUrl() {
      const search = new URLSearchParams(window.location.search);
      let changed = false;
      for (const key of FLOW_ID_PARAMS) {
        if (search.has(key)) {
          search.delete(key);
          changed = true;
        }
      }
      if (changed) {
        const url = `${window.location.origin}${window.location.pathname}?${search.toString()}`;
        window.history.replaceState(null, "", url);
      }
    }

    function errorName(e: unknown): string | undefined {
      if (e && typeof e === "object" && "name" in e) {
        const n = (e as { name?: unknown }).name;
        if (typeof n === "string") return n;
      }
      return undefined;
    }

    async function finish() {
      try {
        if (linkError) throw new Error(linkError);

        if (code) {
          // `exchangeCodeForSession` THROWS AuthPKCECodeVerifierMissingError
          // (it doesn't return { error }) when the PKCE verifier cookie is
          // absent, so every attempt must be wrapped in try/catch.
          let first: unknown = null;
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            first = error;
          } catch (e) {
            first = e;
          }

          const firstIsMissing = errorName(first) === PKCE_VERIFIER_ERROR;

          if (first && !firstIsMissing) {
            throw first;
          }

          if (firstIsMissing) {
            // The flow-id verifier slot is gone/missing. Fall back to the
            // legacy `sb-<ref>-auth-token-code-verifier` cookie, which is
            // dual-written on every recovery request, by dropping the flow id
            // so the SDK does the legacy lookup instead of failing fast.
            stripFlowIdFromUrl();
            try {
              const { error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) throw error;
            } catch (e2) {
              throw e2;
            }
          }
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        } else {
          returnWith("no-params");
          return;
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;

        if (cancelled) return;
        if (!user) {
          returnWith("no-user");
          return;
        }

        const dest = next.startsWith("/") ? next : `/${next}`;
        router.replace(dest);
        router.refresh();
      } catch (err) {
        console.error("[auth/callback] failed", err, window.location.search);
        const name =
          err &&
          typeof err === "object" &&
          "name" in err &&
          typeof (err as { name?: unknown }).name === "string"
            ? (err as { name: string }).name
            : String(err);
        returnWith("exchange-failed", name);
      }
    }

    finish();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AuthShell
      eyebrow="Session"
      title="Signing you in..."
      subtitle="One moment while we finish your request."
    />
  );
}