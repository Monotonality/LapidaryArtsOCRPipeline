import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: rows } = await supabase
    .from("records")
    .select(
      "id, client_name, phone_number, date, date_promised, price, status, created_at, updated_at, creator:profiles!records_created_by_fkey(email), updater:profiles!records_updated_by_fkey(email)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const records = (rows ?? []) as RecordRow[];

  return (
    <main style={{ padding: "2rem", maxWidth: "64rem", margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Dashboard</h1>
          <p style={{ opacity: 0.7, fontSize: "0.875rem" }}>
            Signed in as {user.email}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{
              padding: "0.5rem 0.875rem",
              border: "1px solid var(--foreground)",
              background: "transparent",
              color: "var(--foreground)",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Records</h2>
          <Link
            href="#"
            style={{
              fontSize: "0.875rem",
              textDecoration: "underline",
              opacity: 0.8,
            }}
          >
            Search / filter (next)
          </Link>
        </div>

        {records.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: "0.9375rem" }}>
            No records yet. The audit columns (created by / updated by) are
            wired up in the database.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Date Promised</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created by</th>
                  <th style={thStyle}>Updated by</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid" }}>
                    <td style={tdStyle}>{r.client_name ?? "-"}</td>
                    <td style={tdStyle}>{r.phone_number ?? "-"}</td>
                    <td style={tdStyle}>{r.date ?? "-"}</td>
                    <td style={tdStyle}>{r.date_promised ?? "-"}</td>
                    <td style={tdStyle}>{r.price ?? "-"}</td>
                    <td style={tdStyle}>{r.status}</td>
                    <td style={tdStyle}>{emailOf(r.creator) ?? "-"}</td>
                    <td style={tdStyle}>{emailOf(r.updater) ?? "-"}</td>
                    <td style={tdStyle}>
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.625rem",
  borderBottom: "1px solid",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.625rem",
};