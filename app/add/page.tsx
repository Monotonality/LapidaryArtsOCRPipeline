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

  if (myProfile?.status === "deleted") {
    redirect("/login?status=deleted");
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