import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { DeleteAccountButton } from "./delete-account-button";
import { ChangePasswordForm } from "./change-password-form";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, status, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const status = profile?.status ?? "unknown";
  const joined = profile?.created_at
    ? new Date(profile.created_at)
    : user.created_at
      ? new Date(user.created_at)
      : null;

  return (
    <>
      <Navbar email={user.email ?? ""} />

      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Settings</h1>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Account</h2>
          </div>
          <dl className={styles.details}>
            <div className={styles.detailRow}>
              <dt>Email</dt>
              <dd>{profile?.email ?? user.email}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Status</dt>
              <dd>
                <span
                  className={
                    status === "approved"
                      ? styles.pillActive
                      : styles.pillNeutral
                  }
                >
                  {status}
                </span>
              </dd>
            </div>
            {joined && (
              <div className={styles.detailRow}>
                <dt>Joined</dt>
                <dd>{joined.toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Password</h2>
          </div>
          <ChangePasswordForm />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Danger zone</h2>
          </div>
          <div className={styles.danger}>
            <div className={styles.dangerBody}>
              <p className={styles.dangerTitle}>Deactivate my account</p>
              <p>
                Removes your access to the records ledger. Your profile is kept
                on file, so records you created keep your email on them.
              </p>
            </div>
            <DeleteAccountButton />
          </div>
        </section>
      </main>
    </>
  );
}