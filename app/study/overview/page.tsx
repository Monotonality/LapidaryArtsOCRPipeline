import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { CORPUS_SIZE } from "../corpus";
import type { StudyArchiveRow, StudyEntryRow, StudyValidationRow } from "../actions";
import { ArchiveForm } from "../archive-form";
import styles from "../study.module.css";

function mean(rows: StudyEntryRow[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + Number(r.duration_seconds ?? 0), 0);
  return total / rows.length;
}

function fmtSeconds(v: number | null): string {
  return v === null ? "n/a" : `${v.toFixed(1)} s`;
}

function fmtPercent(v: number | null, digits = 1): string {
  return v === null ? "n/a" : `${(v * 100).toFixed(digits)}%`;
}

export default async function StudyOverviewPage() {
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

  const [{ data: entryRows }, { data: validationRows }, { data: archiveRows }] =
    await Promise.all([
      supabase.from("study_entries").select("*"),
      supabase.from("study_validations").select("*"),
      supabase
        .from("study_archives")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  const entries = (entryRows ?? []) as StudyEntryRow[];
  const validations = (validationRows ?? []) as StudyValidationRow[];
  const archives = (archiveRows ?? []) as StudyArchiveRow[];

  const control = entries.filter((r) => r.condition === "control");
  const experimental = entries.filter((r) => r.condition === "experimental");

  const meanControl = mean(control);
  const meanExperimental = mean(experimental);
  const speedImprovement =
    meanControl && meanExperimental !== null && meanControl > 0
      ? (meanControl - meanExperimental) / meanControl
      : null;

  const majorCount = validations.filter((v) => v.major_correction).length;
  const errorRate = validations.length > 0 ? majorCount / validations.length : null;
  const accuracy = errorRate === null ? null : 1 - errorRate;

  const wrongCounts = {
    client_name: validations.filter((v) => v.wrong_client_name).length,
    phone_number: validations.filter((v) => v.wrong_phone_number).length,
    date: validations.filter((v) => v.wrong_date).length,
    date_promised: validations.filter((v) => v.wrong_date_promised).length,
    instructions: validations.filter((v) => v.wrong_instructions).length,
    price: validations.filter((v) => v.wrong_price).length,
  };

  const inputTokens = experimental.reduce(
    (sum, r) => sum + (r.input_tokens ?? 0),
    0,
  );
  const outputTokens = experimental.reduce(
    (sum, r) => sum + (r.output_tokens ?? 0),
    0,
  );
  const apiCostPerRecord =
    (inputTokens * 0.03) / 1_000_000 + (outputTokens * 0.13) / 1_000_000;

  const stats = [
    {
      label: "Control",
      value: `${control.length} / ${CORPUS_SIZE}`,
      hint: "records saved",
    },
    {
      label: "Experimental",
      value: `${experimental.length} / ${CORPUS_SIZE}`,
      hint: "records saved",
    },
    {
      label: "Audited",
      value: `${validations.length} / ${CORPUS_SIZE}`,
      hint: "records validated",
    },
    {
      label: "Mean control",
      value: fmtSeconds(meanControl),
      hint: "open to submit",
    },
    {
      label: "Mean experimental",
      value: fmtSeconds(meanExperimental),
      hint: "open to submit",
    },
    {
      label: "Speed improvement",
      value: fmtPercent(speedImprovement),
      hint: "OCR vs manual",
    },
    {
      label: "Record error rate",
      value: fmtPercent(errorRate),
      hint: `${majorCount} major corrections`,
    },
    {
      label: "System accuracy",
      value: fmtPercent(accuracy),
      hint: "records acceptable",
    },
  ];

  const wrongRows = [
    { field: "Client name", count: wrongCounts.client_name },
    { field: "Phone number", count: wrongCounts.phone_number },
    { field: "Date", count: wrongCounts.date },
    { field: "Date promised", count: wrongCounts.date_promised },
    { field: "Instructions", count: wrongCounts.instructions },
    { field: "Price", count: wrongCounts.price },
  ];

  return (
    <>
      <Navbar email={user.email ?? ""} />
      <main className={styles.main}>
        <div className={styles.subhead}>
          <div className={styles.pageTitle}>
            <h1>Study overview</h1>
          </div>
          <Link href="/study" className={styles.backLink}>
            Back to study
          </Link>
        </div>

        <div className={styles.statGrid}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statHint}>{s.hint}</span>
            </div>
          ))}
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Field-level errors</h2>
            <p className={styles.sectionHelp}>
              Counted across {validations.length} audited records. A record can
              contribute to several fields.
            </p>
          </div>
          {validations.length === 0 ? (
            <p className={styles.empty}>
              No audits yet. Field error counts appear after the first
              validation.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th className={styles.tableNum}>Marked wrong</th>
                    <th className={styles.tableNum}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {wrongRows.map((r) => (
                    <tr key={r.field}>
                      <td>{r.field}</td>
                      <td className={styles.tableNum}>{r.count}</td>
                      <td className={styles.tableNum}>
                        {fmtPercent(r.count / validations.length)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Cost inputs</h2>
            <p className={styles.sectionHelp}>
              Token totals from logged OCR extractions, priced at $0.03 per
              1M input tokens and $0.13 per 1M output tokens.
            </p>
          </div>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Input tokens</span>
              <span className={styles.statValue}>
                {inputTokens.toLocaleString()}
              </span>
              <span className={styles.statHint}>experimental entries</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Output tokens</span>
              <span className={styles.statValue}>
                {outputTokens.toLocaleString()}
              </span>
              <span className={styles.statHint}>experimental entries</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>API cost so far</span>
              <span className={styles.statValue}>
                ${apiCostPerRecord.toFixed(6)}
              </span>
              <span className={styles.statHint}>
                measured on saved entries
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Downloads</h2>
            <p className={styles.sectionHelp}>
              Raw timing logs and audit sheet exports so every figure can be
              recomputed independently.
            </p>
          </div>
          <div className={styles.downloadRow}>
            <a className={styles.downloadLink} href="/study/export?dataset=entries&format=csv">
              Entries CSV
            </a>
            <a className={styles.downloadLink} href="/study/export?dataset=entries&format=json">
              Entries JSON
            </a>
            <a className={styles.downloadLink} href="/study/export?dataset=validations&format=csv">
              Validations CSV
            </a>
            <a className={styles.downloadLink} href="/study/export?dataset=validations&format=json">
              Validations JSON
            </a>
            <a className={styles.downloadLink} href="/study/export?dataset=archives&format=csv">
              Archives index CSV
            </a>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Archive</h2>
            <p className={styles.sectionHelp}>
              Stores an immutable snapshot of every entry and audit collected so
              far, so the dataset can be frozen at a point in time.
            </p>
          </div>
          <ArchiveForm />
          {archives.length === 0 ? (
            <p className={styles.empty}>No archives yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Created</th>
                    <th className={styles.tableNum}>Control</th>
                    <th className={styles.tableNum}>Experimental</th>
                    <th className={styles.tableNum}>Audits</th>
                    <th>Snapshot</th>
                  </tr>
                </thead>
                <tbody>
                  {archives.map((a) => (
                    <tr key={a.id}>
                      <td>{a.label}</td>
                      <td className={styles.tableNum}>
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className={styles.tableNum}>{a.control_count}</td>
                      <td className={styles.tableNum}>{a.experimental_count}</td>
                      <td className={styles.tableNum}>{a.validation_count}</td>
                      <td>
                        <a
                          className={styles.downloadLink}
                          href={`/study/export?dataset=archives&format=json&id=${a.id}`}
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
