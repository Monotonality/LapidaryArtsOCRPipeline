"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setSignupStatus(
  userId: string,
  status: "approved" | "rejected",
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) {
    console.error("Failed to update signup status", error);
  }

  revalidatePath("/dashboard");
}