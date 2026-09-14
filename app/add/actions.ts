"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateRecordState = {
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

  const read = (key: string) => String(formData.get(key) ?? "").trim();

  const rawPrice = read("price");
  const price = rawPrice === "" ? null : Number(rawPrice.replace(",", "."));

  if (price !== null && !Number.isFinite(price)) {
    return { error: "Price must be a number, e.g. 125.50" };
  }

  const { error } = await supabase.from("records").insert({
    client_name: read("client_name") || null,
    phone_number: read("phone_number") || null,
    date: read("date") || null,
    date_promised: read("date_promised") || null,
    instructions: read("instructions") || null,
    price,
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