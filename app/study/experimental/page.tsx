import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { CORPUS, nextUncompleted } from "../corpus";
import { EntryRunner } from "../entry-runner";
import styles from "../study.module.css";

export default async function StudyExperimentalPage() {
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
    .eq("condition", "experimental");

  const completed = (rows ?? []).map((r) => r.corpus_label);
  const initialLabel = nextUncompleted(completed) ?? CORPUS[0]?.label ?? null;

  return (
    <>
      <Navbar email={user.email ?? ""} />
      <main className={styles.main}>
        <div className={styles.subhead}>
          <div className={styles.pageTitle}>
            <h1>Experimental group</h1>
          </div>
          <Link href="/study" className={styles.backLink}>
            Back to study
          </Link>
        </div>
        <p className={styles.sectionHelp}>
          OCR-assisted entry. Run OCR to prefill the six fields, then review and
          overwrite anything wrong. The same open-to-submit timer is logged, and
          token counts from the extraction are stored for the cost model.
        </p>
        <EntryRunner
          condition="experimental"
          ocrEnabled={true}
          initialLabel={initialLabel}
          initialCompleted={completed}
        />
      </main>
    </>
  );
}
