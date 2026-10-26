"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseRecordForm } from "@/lib/record-fields";

type CreateRecordState = {
  error?: string;
};

export async function createRecord(
  _prev: CreateRecordState,
  formData: FormData,
): Promise<CreateRecordState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to add a record." };
  }

  const parsed = parseRecordForm(formData, "iso");
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from("records").insert({
    ...parsed.record,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error("Failed to create record", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}