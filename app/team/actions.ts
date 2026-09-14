"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";

export type MemberStatusState = { error?: string };

export async function addMember(
  prev: MemberStatusState | undefined,
  formData: FormData,
): Promise<MemberStatusState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const admin = createAdmin();

  const { data: existing } = await admin.auth.admin.listUsers();
  if (existing?.users.some((u) => u.email?.toLowerCase() === email)) {
    return { error: "An account with that email already exists." };
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error("Failed to create user", error);
    return { error: "We couldn't create that account. Please try again." };
  }

  revalidatePath("/team");
  return {};
}

export async function setMemberStatus(
  userId: string,
  status: "approved" | "deleted",
  prev: MemberStatusState | undefined,
  formData: FormData,
): Promise<MemberStatusState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (userId === user.id) {
    return { error: "You can't deactivate your own account from here." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) {
    console.error("Failed to update member status", error);
    return { error: "We couldn't update that account. Please try again." };
  }

  revalidatePath("/team");
  return {};
}