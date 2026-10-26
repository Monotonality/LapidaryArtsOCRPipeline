"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  dateToIso,
  displayValue,
  isoToDate,
  statusFromRow,
  type FieldKey,
} from "@/lib/record-fields";
import { DateInput } from "@/app/field-inputs";
import styles from "./dashboard.module.css";

export type RecordRow = {
  id: string;
  client_name: string | null;
  phone_number: string | null;
  date: string | null;
  date_promised: string | null;
  price: string | number | null;
  na_fields: string[] | null;
  invalid_fields: string[] | null;
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
  | "price";

type SortDir = "asc" | "desc";

type RangePreset = "any" | "today" | "d7" | "d30" | "month" | "custom";

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "d7", label: "Last 7 days" },
  { value: "d30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFromPreset(
  preset: RangePreset,
  from: string,
  to: string,
): { from: string; to: string } {
  // Custom bounds are typed as MM-DD-YY; ignore them until they are complete.
  if (preset === "custom") {
    return { from: dateToIso(from) ?? "", to: dateToIso(to) ?? "" };
  }
  if (preset === "any") return { from: "", to: "" };

  const today = new Date();

  if (preset === "today") {
    return { from: localIso(today), to: localIso(today) };
  }

  if (preset === "d7" || preset === "d30") {
    const start = new Date(today);
    start.setDate(start.getDate() - (preset === "d7" ? 6 : 29));
    return { from: localIso(start), to: localIso(today) };
  }

  // month
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: localIso(start), to: localIso(today) };
}

const SORT_LABELS: Record<SortKey, string> = {
  client_name: "Client",
  phone_number: "Phone",
  date: "Date",
  date_promised: "Date Promised",
  price: "Price",
};

function emailOf(
  ref: RecordRow["creator"],
): string | null {
  if (Array.isArray(ref)) return ref[0]?.email ?? null;
  return ref?.email ?? null;
}

/** Table/CSV text for a field: N/A or Invalid when flagged, dates as MM-DD-YY. */
function cellText(row: RecordRow, key: FieldKey & keyof RecordRow): string {
  const value = row[key] as string | number | null;
  const shown = key === "date" || key === "date_promised"
    ? isoToDate(value as string | null)
    : value;
  return displayValue(statusFromRow(row)[key], shown);
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
  const [datePreset, setDatePreset] = useState<RangePreset>("any");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [promisedPreset, setPromisedPreset] = useState<RangePreset>("any");
  const [promisedFrom, setPromisedFrom] = useState("");
  const [promisedTo, setPromisedTo] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;

    function onPointerDown(e: PointerEvent) {
      if (!filtersRef.current?.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

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
    setDatePreset("any");
    setDateFrom("");
    setDateTo("");
    setPromisedPreset("any");
    setPromisedFrom("");
    setPromisedTo("");
    setPriceMin("");
    setPriceMax("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const priceMinN = toNumber(priceMin);
    const priceMaxN = toNumber(priceMax);
    const dateRange = rangeFromPreset(datePreset, dateFrom, dateTo);
    const promisedRange = rangeFromPreset(
      promisedPreset,
      promisedFrom,
      promisedTo,
    );

    let rows = records.filter((r) => {
      if (q) {
        const haystack = [
          cellText(r, "client_name"),
          cellText(r, "phone_number"),
          cellText(r, "date"),
          cellText(r, "date_promised"),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (dateRange.from && (!r.date || r.date < dateRange.from))
        return false;
      if (dateRange.to && (!r.date || r.date > dateRange.to)) return false;
      if (
        promisedRange.from &&
        (!r.date_promised || r.date_promised < promisedRange.from)
      )
        return false;
      if (
        promisedRange.to &&
        (!r.date_promised || r.date_promised > promisedRange.to)
      )
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
    datePreset,
    dateFrom,
    dateTo,
    promisedPreset,
    promisedFrom,
    promisedTo,
    priceMin,
    priceMax,
    sortKey,
    sortDir,
  ]);

  const activeFilterCount =
    (datePreset !== "any" ? 1 : 0) +
    (promisedPreset !== "any" ? 1 : 0) +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0);

  function handleExport() {
    const body = filtered.map((r) => [
      cellText(r, "client_name"),
      cellText(r, "phone_number"),
      cellText(r, "date"),
      cellText(r, "date_promised"),
      cellText(r, "price"),
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
        <div className={styles.filtersWrap} ref={filtersRef}>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen((o) => !o)}
            className={styles.filtersButton}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className={styles.filtersBadge}>{activeFilterCount}</span>
            )}
          </button>

          {filtersOpen && (
            <div
              role="dialog"
              aria-label="Filter records"
              className={styles.filterPopover}
            >
              <div className={styles.filterGrid}>
                <label className={styles.filterField}>
                  <span className={styles.filterLabel}>Date</span>
                  <select
                    value={datePreset}
                    onChange={(e) =>
                      setDatePreset(e.target.value as RangePreset)
                    }
                    className={styles.filterInput}
                  >
                    {RANGE_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.filterField}>
                  <span className={styles.filterLabel}>Date promised</span>
                  <select
                    value={promisedPreset}
                    onChange={(e) =>
                      setPromisedPreset(e.target.value as RangePreset)
                    }
                    className={styles.filterInput}
                  >
                    {RANGE_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {datePreset === "custom" && (
                  <div className={styles.rangeRow}>
                    <label className={styles.filterField}>
                      <span className={styles.filterLabel}>Date from</span>
                      <DateInput
                        value={dateFrom}
                        onValueChange={setDateFrom}
                        className={styles.filterInput}
                      />
                    </label>
                    <label className={styles.filterField}>
                      <span className={styles.filterLabel}>Date to</span>
                      <DateInput
                        value={dateTo}
                        onValueChange={setDateTo}
                        className={styles.filterInput}
                      />
                    </label>
                  </div>
                )}
                {promisedPreset === "custom" && (
                  <div className={styles.rangeRow}>
                    <label className={styles.filterField}>
                      <span className={styles.filterLabel}>Promised from</span>
                      <DateInput
                        value={promisedFrom}
                        onValueChange={setPromisedFrom}
                        className={styles.filterInput}
                      />
                    </label>
                    <label className={styles.filterField}>
                      <span className={styles.filterLabel}>Promised to</span>
                      <DateInput
                        value={promisedTo}
                        onValueChange={setPromisedTo}
                        className={styles.filterInput}
                      />
                    </label>
                  </div>
                )}
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
              <div className={styles.filterPopoverFooter}>
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                  className={styles.clearFilters}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>
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
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {cellText(r, "client_name") || (
                        <span className={styles.cellMuted}>-</span>
                      )}
                    </td>
                    <td className={styles.cellMono}>
                      {cellText(r, "phone_number") || "-"}
                    </td>
                    <td className={styles.cellMono}>
                      {cellText(r, "date") || "-"}
                    </td>
                    <td className={styles.cellMono}>
                      {cellText(r, "date_promised") || "-"}
                    </td>
                    <td className={`${styles.cellMono} ${styles.cellNum}`}>
                      {cellText(r, "price") || "-"}
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
    </section>
  );
}