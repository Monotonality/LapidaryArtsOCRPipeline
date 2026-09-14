"use client";

import { useMemo, useState } from "react";
import styles from "./dashboard.module.css";

export type RecordRow = {
  id: string;
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  price: string | number | null;
  status: string;
  created_at: string;
  updated_at: string;
  creator: { email: string | null } | { email: string | null }[] | null;
  updater: { email: string | null } | { email: string | null }[] | null;
};

function emailOf(
  ref: RecordRow["creator"],
): string | null {
  if (Array.isArray(ref)) return ref[0]?.email ?? null;
  return ref?.email ?? null;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(csv: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lapidary-records-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const EXPORT_COLUMNS = [
  "Client",
  "Phone",
  "Date",
  "Date promised",
  "Price",
  "Status",
  "Created",
  "Updated",
  "Created by",
  "Updated by",
];

export function RecordsView({ records }: { records: RecordRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (!q) return true;
      return (
        (r.client_name ?? "").toLowerCase().includes(q) ||
        (r.phone_number ?? "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.date ?? "").toLowerCase().includes(q) ||
        (r.date_promised ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, query]);

  function handleExport() {
    const body = filtered.map((r) => [
      r.client_name ?? "",
      r.phone_number ?? "",
      r.date ?? "",
      r.date_promised ?? "",
      r.price != null ? String(r.price) : "",
      r.status,
      r.created_at ? new Date(r.created_at).toLocaleString() : "",
      r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
      emailOf(r.creator) ?? "",
      emailOf(r.updater) ?? "",
    ]);
    downloadCsv(toCsv([EXPORT_COLUMNS, ...body]));
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>Records</h2>
        <span className={styles.count}>{filtered.length}</span>
      </div>

      <div className={styles.toolbar}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client, phone, or status"
          aria-label="Search records"
          className={styles.search}
        />
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className={styles.export}
        >
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {records.length === 0
            ? "No records yet. Once the import pipeline is connected, digitized invoices will appear here with the client, dates, price, and status."
            : "No records match your search or filter."}
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
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.client_name ?? (
                        <span className={styles.cellMuted}>-</span>
                      )}
                    </td>
                    <td className={styles.cellMono}>
                      {r.phone_number ?? "-"}
                    </td>
                    <td className={styles.cellMono}>{r.date ?? "-"}</td>
                    <td className={styles.cellMono}>
                      {r.date_promised ?? "-"}
                    </td>
                    <td className={`${styles.cellMono} ${styles.cellNum}`}>
                      {r.price ?? "-"}
                    </td>
                    <td>
                      <span
                        className={
                          r.status === "approved"
                            ? styles.statusPillApproved
                            : r.status === "rejected"
                              ? styles.statusPillRejected
                              : styles.statusPillPending
                        }
                      >
                        {r.status}
                      </span>
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
  );
}