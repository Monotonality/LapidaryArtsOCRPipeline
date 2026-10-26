import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import type { StudyEntryRow, StudyValidationRow } from "../actions";
import {
  ValidatorRunner,
  type ExistingValidation,
  type ValidatorEntry,
} from "../validator-runner";
import styles from "../study.module.css";

function toEntryMap(
  rows: StudyEntryRow[],
  condition: string,
): Record<string, ValidatorEntry> {
  const map: Record<string, ValidatorEntry> = {};
  for (const row of rows) {
    if (row.condition !== condition) continue;
    map[row.corpus_label] = {
      client_name: row.client_name,
      phone_number: row.phone_number,
      date: row.date,
      date_promised: row.date_promised,
      instructions: row.instructions,
      price: row.price,
      na_fields: row.na_fields,
      invalid_fields: row.invalid_fields,
    };
  }
  return map;
}

function toValidationMap(
  rows: StudyValidationRow[],
): Record<string, ExistingValidation> {
  const map: Record<string, ExistingValidation> = {};
  for (const row of rows) {
    map[row.corpus_label] = {
      major_correction: row.major_correction,
      wrong_client_name: row.wrong_client_name,
      wrong_phone_number: row.wrong_phone_number,
      wrong_date: row.wrong_date,
      wrong_date_promised: row.wrong_date_promised,
      wrong_instructions: row.wrong_instructions,
      wrong_price: row.wrong_price,
      notes: row.notes,
    };
  }
  return map;
}

export default async function StudyValidatorPage() {
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

  const [{ data: entryRows }, { data: validationRows }] = await Promise.all([
    supabase.from("study_entries").select("*"),
    supabase.from("study_validations").select("*"),
  ]);

  const entries = (entryRows ?? []) as StudyEntryRow[];
  const validations = (validationRows ?? []) as StudyValidationRow[];

  return (
    <>
      <Navbar email={user.email ?? ""} />
      <main className={`${styles.main} ${styles.mainWide}`}>
        <div className={styles.subhead}>
          <div className={styles.pageTitle}>
            <h1>Validator</h1>
          </div>
          <Link href="/study" className={styles.backLink}>
            Back to study
          </Link>
        </div>
        <p className={styles.sectionHelp}>
          Compare each OCR-assisted transcription against the original photo and
          the ground-truth control entry. Mark every field that is wrong, then
          classify the record as acceptable or needing major correction.
        </p>
        <ValidatorRunner
          experimentalByLabel={toEntryMap(entries, "experimental")}
          controlByLabel={toEntryMap(entries, "control")}
          validationsByLabel={toValidationMap(validations)}
        />
      </main>
    </>
  );
}
