import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { setSignupStatus } from "./actions";
import styles from "./pending.module.css";

type PendingProfile = {
  id: string;
  email: string;
  created_at: string;
};

export default async function PendingPage() {
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

  const { data: pendingQuery } = await supabase
    .from("profiles")
    .select("id, email, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pending = (pendingQuery ?? []) as PendingProfile[];

  return (
    <>
      <Navbar email={user.email ?? ""} />

      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Pending signups</h1>
          <span className={styles.count}>{pending.length}</span>
        </div>

        {pending.length === 0 ? (
          <p className={styles.empty}>
            No new accounts waiting on a decision.
          </p>
        ) : (
          <ul className={styles.list}>
            {pending.map((p) => (
              <li key={p.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{p.email}</p>
                  <p className={styles.itemMeta}>
                    Requested {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <div className={styles.itemActions}>
                  <form
                    action={setSignupStatus.bind(null, p.id, "approved")}
                  >
                    <button type="submit" className={styles.approve}>
                      Approve
                    </button>
                  </form>
                  <form
                    action={setSignupStatus.bind(null, p.id, "rejected")}
                  >
                    <button type="submit" className={styles.reject}>
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}