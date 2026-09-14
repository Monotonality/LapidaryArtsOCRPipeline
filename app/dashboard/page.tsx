import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { RecordsView, type RecordRow } from "./records-view";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("status, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (myProfile?.status === "deleted") {
    redirect("/login?status=deleted");
  }

  const { data: rows } = await supabase
    .from("records")
    .select(
      "id, client_name, phone_number, date, date_promised, price, created_at, updated_at, created_by, updated_by",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const userIds = [
    ...new Set(
      (rows ?? [])
        .flatMap((r) => [r.created_by, r.updated_by])
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  let emails: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.email) emails[p.id] = p.email;
    }
  }

  const records = (rows ?? []).map((r) => ({
    ...r,
    creator: r.created_by ? { email: emails[r.created_by] ?? null } : null,
    updater: r.updated_by ? { email: emails[r.updated_by] ?? null } : null,
  })) as RecordRow[];

  return (
    <>
      <Navbar email={user.email ?? ""} isAdmin={myProfile?.is_admin === true} />

      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Records ledger</h1>
        </div>

        <RecordsView records={records} />
      </main>
    </>
  );
}