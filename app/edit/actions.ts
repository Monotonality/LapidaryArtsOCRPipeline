"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseRecordForm } from "@/lib/record-fields";

type UpdateRecordState = {
  error?: string;
};

export async function updateRecord(
  _prev: UpdateRecordState,
  formData: FormData,
): Promise<UpdateRecordState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to edit a record." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "Missing record id." };
  }

  const parsed = parseRecordForm(formData, "iso");
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("records")
    .update({
      ...parsed.record,
      updated_by: user.id,
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to update record", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}