"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";

export type RecordRow = {
  id: string;
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  price: string | number | null;
  created_at: string;
  updated_at: string;
  creator: { email: string | null } | { email: string | null }[] | null;
  updater: { email: string | null } | { email: string | null }[] | null;
};

type SortKey =
  | "client_name"
  | "phone_number"
  | "date"
  | "date_promised"
  | "price"
  | "updated_at";

type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  client_name: "Client",
  phone_number: "Phone",
  date: "Date",
  date_promised: "Date Promised",
  price: "Price",
  updated_at: "Updated",
};

function emailOf(
  ref: RecordRow["creator"],
): string | null {
  if (Array.isArray(ref)) return ref[0]?.email ?? null;
  return ref?.email ?? null;
}

function toNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function sortValue(row: RecordRow, key: SortKey): string | number {
  switch (key) {
    case "price":
      return toNumber(String(row.price ?? "")) ?? Number.NEGATIVE_INFINITY;
    case "updated_at":
      return row.updated_at;
    default:
      return row[key] ?? "";
  }
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
  "Created",
  "Updated",
  "Created by",
  "Updated by",
];

export function RecordsView({ records }: { records: RecordRow[] }) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [promisedFrom, setPromisedFrom] = useState("");
  const [promisedTo, setPromisedTo] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setPromisedFrom("");
    setPromisedTo("");
    setPriceMin("");
    setPriceMax("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const priceMinN = toNumber(priceMin);
    const priceMaxN = toNumber(priceMax);

    let rows = records.filter((r) => {
      if (q) {
        const haystack = [
          r.client_name ?? "",
          r.phone_number ?? "",
          r.date ?? "",
          r.date_promised ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (dateFrom && (!r.date || r.date < dateFrom)) return false;
      if (dateTo && (!r.date || r.date > dateTo)) return false;
      if (promisedFrom && (!r.date_promised || r.date_promised < promisedFrom))
        return false;
      if (promisedTo && (!r.date_promised || r.date_promised > promisedTo))
        return false;

      const priceN = toNumber(String(r.price ?? ""));
      if (priceMinN !== null && (priceN === null || priceN < priceMinN))
        return false;
      if (priceMaxN !== null && (priceN === null || priceN > priceMaxN))
        return false;

      return true;
    });

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * dir;
      });
    }

    return rows;
  }, [
    records,
    query,
    dateFrom,
    dateTo,
    promisedFrom,
    promisedTo,
    priceMin,
    priceMax,
    sortKey,
    sortDir,
  ]);

  const hasFilters =
    query !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    promisedFrom !== "" ||
    promisedTo !== "" ||
    priceMin !== "" ||
    priceMax !== "";

  function handleExport() {
    const body = filtered.map((r) => [
      r.client_name ?? "",
      r.phone_number ?? "",
      r.date ?? "",
      r.date_promised ?? "",
      r.price != null ? String(r.price) : "",
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
          placeholder="Search client, phone, or date"
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

      <div className={styles.filterGrid}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Date from</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.filterInput}
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Date to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.filterInput}
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Promised from</span>
          <input
            type="date"
            value={promisedFrom}
            onChange={(e) => setPromisedFrom(e.target.value)}
            className={styles.filterInput}
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Promised to</span>
          <input
            type="date"
            value={promisedTo}
            onChange={(e) => setPromisedTo(e.target.value)}
            className={styles.filterInput}
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Price min</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="0.00"
            className={styles.filterInput}
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Price max</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="5000.00"
            className={styles.filterInput}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {records.length === 0
            ? "No records yet. Add a record to start the ledger."
            : "No records match your search or filters."}
        </p>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {(
                    [
                      "client_name",
                      "phone_number",
                      "date",
                      "date_promised",
                      "price",
                      "updated_at",
                    ] as SortKey[]
                  ).map((key) => (
                    <th key={key}>
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        aria-label={`Sort by ${SORT_LABELS[key]}`}
                        className={styles.sortButton}
                      >
                        {SORT_LABELS[key]}
                        {sortKey === key && (
                          <span className={styles.sortArrow}>
                            {sortDir === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </button>
                    </th>
                  ))}
                  <th>Created by</th>
                  <th>Edit</th>
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
                    <td className={styles.cellMono}>
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                    <td className={styles.cellMuted}>
                      {emailOf(r.creator) ?? "-"}
                    </td>
                    <td>
                      <Link
                        href={`/edit/${r.id}`}
                        className={styles.editLink}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasFilters && (
        <div className={styles.clearRow}>
          <button type="button" onClick={clearFilters} className={styles.clearFilters}>
            Clear all filters
          </button>
        </div>
      )}
    </section>
  );
}