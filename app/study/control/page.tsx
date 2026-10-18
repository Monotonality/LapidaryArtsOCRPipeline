import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { CORPUS, nextUncompleted } from "../corpus";
import { EntryRunner } from "../entry-runner";
import styles from "../study.module.css";

export default async function StudyControlPage() {
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

  const { data: rows } = await supabase
    .from("study_entries")
    .select("corpus_label")
    .eq("condition", "control");

  const completed = (rows ?? []).map((r) => r.corpus_label);
  const initialLabel = nextUncompleted(completed) ?? CORPUS[0]?.label ?? null;

  return (
    <>
      <Navbar email={user.email ?? ""} />
      <main className={styles.main}>
        <div className={styles.subhead}>
          <div className={styles.pageTitle}>
            <h1>Control group</h1>
          </div>
          <Link href="/study" className={styles.backLink}>
            Back to study
          </Link>
        </div>
        <p className={styles.sectionHelp}>
          Manual entry with the OCR tool disabled. Type all six fields from the
          card; the timer runs from the moment the record opens until it is
          saved.
        </p>
        <EntryRunner
          condition="control"
          ocrEnabled={false}
          initialLabel={initialLabel}
          initialCompleted={completed}
        />
      </main>
    </>
  );
}
