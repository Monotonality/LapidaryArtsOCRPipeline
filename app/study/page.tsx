import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { CORPUS_SIZE } from "./corpus";
import styles from "./study.module.css";

export default async function StudyPage() {
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

  const [{ count: controlCount }, { count: experimentalCount }, { count: validationCount }] =
    await Promise.all([
      supabase
        .from("study_entries")
        .select("id", { count: "exact", head: true })
        .eq("condition", "control"),
      supabase
        .from("study_entries")
        .select("id", { count: "exact", head: true })
        .eq("condition", "experimental"),
      supabase
        .from("study_validations")
        .select("id", { count: "exact", head: true }),
    ]);

  const cards = [
    {
      href: "/study/control",
      title: "Control",
      hint: "Manual entry, OCR disabled. Person A transcribes each record and the app times open to submit.",
      stat: `${controlCount ?? 0} / ${CORPUS_SIZE} records`,
    },
    {
      href: "/study/experimental",
      title: "Experimental",
      hint: "OCR-assisted entry. The model extracts the six fields, you review and overwrite errors while the same timer runs.",
      stat: `${experimentalCount ?? 0} / ${CORPUS_SIZE} records`,
    },
    {
      href: "/study/validator",
      title: "Validator",
      hint: "Person C compares each OCR-assisted transcription against the ground-truth record and marks the fields that are wrong.",
      stat: `${validationCount ?? 0} / ${CORPUS_SIZE} audited`,
    },
    {
      href: "/study/overview",
      title: "Overview",
      hint: "Progress, timing means, record error rate, and dataset archive and download.",
      stat: "Status and exports",
    },
  ];

  return (
    <>
      <Navbar email={user.email ?? ""} />
      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Study</h1>
        </div>
        <p className={styles.sectionHelp}>
          Efficacy, accuracy, and cost-benefit study over a corpus of{" "}
          {CORPUS_SIZE} handwritten record samples. Each record is entered once
          per condition and audited once.
        </p>
        <div className={styles.cards}>
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className={styles.card}>
              <span className={styles.cardTitle}>{c.title}</span>
              <span className={styles.cardHint}>{c.hint}</span>
              <span className={styles.cardStat}>{c.stat}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
