"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_admin) {
    return {
      error:
        "You're the only admin. Transfer the admin role to someone else first.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      status: "deleted",
      status_updated_by: user.id,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to soft-delete profile", error);
    return {
      error: "We couldn't delete your profile. Please try again.",
    };
  }

  await supabase.auth.signOut();
  redirect("/login");
}