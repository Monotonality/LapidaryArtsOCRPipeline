"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";

export type MemberStatusState = { error?: string; success?: string };

async function requireAdmin(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
    return { ok: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "deleted") {
    return { ok: false, error: "This account has been deactivated." };
  }

  if (!profile?.is_admin) {
    return { ok: false, error: "Only an admin can manage the team." };
  }

  return { ok: true };
}

export async function addMember(
  prev: MemberStatusState | undefined,
  formData: FormData,
): Promise<MemberStatusState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

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
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && userId === user.id && status === "deleted") {
    return {
      error:
        "You can't deactivate yourself. If you're leaving, transfer the admin role first.",
    };
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

export async function resetMemberPassword(
  userId: string,
  email: string,
  prev: MemberStatusState | undefined,
  formData: FormData,
): Promise<MemberStatusState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const admin = createAdmin();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("Failed to reset member password", error);
    return { error: "We couldn't reset that password. Please try again." };
  }

  revalidatePath("/team");
  return {
    success: `New temporary password set for ${email}. Share it out of band.`,
  };
}

export async function transferAdminRole(
  prev: MemberStatusState | undefined,
  formData: FormData,
): Promise<MemberStatusState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const newAdminId = String(formData.get("member_id") ?? "");
  const confirmEmail = String(formData.get("confirm_email") ?? "")
    .trim()
    .toLowerCase();

  if (!newAdminId) {
    return { error: "Choose the member who should become the admin." };
  }

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("profiles")
    .select("id, email, status")
    .eq("id", newAdminId)
    .maybeSingle();

  if (!member || member.status === "deleted") {
    return { error: "That member no longer exists." };
  }

  if (member.email?.toLowerCase() !== confirmEmail) {
    return {
      error:
        "Confirmation email doesn't match. Type the member's email exactly to confirm.",
    };
  }

  const { error } = await supabase.rpc("transfer_admin", {
    new_admin_id: member.id,
  });

  if (error) {
    console.error("Failed to transfer admin role", error);
    return { error: "Only one admin is allowed. Please try again." };
  }

  revalidatePath("/team");
  return { success: `Admin role transferred to ${member.email}.` };
}