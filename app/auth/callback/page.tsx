"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/app/auth-shell";

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

    async function finish() {
      try {
        if (linkError) throw new Error(linkError);

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;

        if (cancelled) return;
        if (!user) {
          router.replace("/login?status=error");
          router.refresh();
          return;
        }

        const dest = next.startsWith("/") ? next : `/${next}`;
        router.replace(dest);
        router.refresh();
      } catch {
        if (cancelled) return;
        router.replace("/login?status=error");
        router.refresh();
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