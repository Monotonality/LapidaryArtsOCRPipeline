"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

    async function finish() {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        if (cancelled) return;
        if (!session) {
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