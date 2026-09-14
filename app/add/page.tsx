import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { AddRecord } from "./add-form";
import styles from "./add.module.css";

export default async function AddPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  const { count: approvedCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  // Bootstrap: until the first approval exists, the first signups are admitted.
  const isApproved =
    approvedCount && approvedCount > 0
      ? myProfile?.status === "approved"
      : true;

  if (!isApproved) {
    redirect("/login?status=pending");
  }

  return (
    <>
      <Navbar email={user.email ?? ""} />

      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Add record</h1>
        </div>

        <AddRecord />
      </main>
    </>
  );
}