import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/app/brand";
import { setSignupStatus } from "./actions";
import styles from "./dashboard.module.css";

type ProfileRef =
  | { email: string | null }
  | { email: string | null }[]
  | null;

type RecordRow = {
  id: string;
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  price: string | number | null;
  status: string;
  created_at: string;
  updated_at: string;
  creator: ProfileRef;
  updater: ProfileRef;
};

type PendingProfile = {
  id: string;
  email: string;
  created_at: string;
};

function emailOf(ref: ProfileRef): string | null {
  if (Array.isArray(ref)) return ref[0]?.email ?? null;
  return ref?.email ?? null;
}

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

  const { data: rows } = await supabase
    .from("records")
    .select(
      "id, client_name, phone_number, date, date_promised, price, status, created_at, updated_at, creator:profiles!records_created_by_fkey(email), updater:profiles!records_updated_by_fkey(email)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const records = (rows ?? []) as RecordRow[];
  const pending = (pendingQuery ?? []) as PendingProfile[];

  return (
    <main className={styles.main}>
      <header className={styles.masthead}>
        <Brand />
        <div className={styles.session}>
          <span className={styles.userEmail}>{user.email}</span>
          <Link href="/settings" className={styles.settings}>
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signOut}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className={styles.pageTitle}>
        <h1>Records ledger</h1>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Pending signups</h2>
          {pending.length > 0 && (
            <span className={styles.count}>{pending.length}</span>
          )}
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
                  <form action={setSignupStatus.bind(null, p.id, "approved")}>
                    <button type="submit" className={styles.approve}>
                      Approve
                    </button>
                  </form>
                  <form action={setSignupStatus.bind(null, p.id, "rejected")}>
                    <button type="submit" className={styles.reject}>
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Records</h2>
          <Link href="#" className={styles.filterLink}>
            Search &amp; filter — coming soon
          </Link>
        </div>

        {records.length === 0 ? (
          <p className={styles.empty}>
            No records yet. Once the import pipeline is connected, digitized
            invoices will appear here with the client, dates, price, and
            status.
          </p>
        ) : (
          <div className={styles.tableCard}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Phone</th>
                    <th>Date</th>
                    <th>Date Promised</th>
                    <th className={styles.cellNum}>Price</th>
                    <th>Status</th>
                    <th>Created by</th>
                    <th>Updated by</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.client_name ?? <span className={styles.cellMuted}>-</span>}</td>
                      <td className={styles.cellMono}>
                        {r.phone_number ?? "-"}
                      </td>
                      <td className={styles.cellMono}>
                        {r.date ?? "-"}
                      </td>
                      <td className={styles.cellMono}>
                        {r.date_promised ?? "-"}
                      </td>
                      <td className={`${styles.cellMono} ${styles.cellNum}`}>
                        {r.price ?? "-"}
                      </td>
                      <td>
                        <span className={styles.statusPill}>{r.status}</span>
                      </td>
                      <td className={styles.cellMuted}>
                        {emailOf(r.creator) ?? "-"}
                      </td>
                      <td className={styles.cellMuted}>
                        {emailOf(r.updater) ?? "-"}
                      </td>
                      <td className={styles.cellMono}>
                        {new Date(r.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}