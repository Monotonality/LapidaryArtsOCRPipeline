import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { AddMemberForm } from "./add-member-form";
import { MemberToggle } from "./member-toggle";
import { ChangePasswordForm } from "./change-password-form";
import styles from "./team.module.css";

type Member = {
  id: string;
  email: string;
  status: string;
  created_at: string;
};

export default async function TeamPage() {
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

  const { data: query } = await supabase
    .from("profiles")
    .select("id, email, status, created_at")
    .order("created_at", { ascending: true });

  const members = (query ?? []) as Member[];

  return (
    <>
      <Navbar email={user.email ?? ""} />

      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Team</h1>
          <span className={styles.count}>{members.length}</span>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Add a member</h2>
            <p className={styles.sectionHelp}>
              New accounts are created confirmed and approved immediately.
            </p>
          </div>
          <AddMemberForm />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Change my password</h2>
            <p className={styles.sectionHelp}>
              Replaces the temporary password you were given.
            </p>
          </div>
          <ChangePasswordForm />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Members</h2>
          </div>

          {members.length === 0 ? (
            <p className={styles.empty}>No members yet.</p>
          ) : (
            <ul className={styles.list}>
              {members.map((m) => {
                const isDeleted = m.status === "deleted";
                const isSelf = m.id === user.id;
                return (
                  <li key={m.id} className={styles.item}>
                    <div className={styles.itemBody}>
                      <p className={styles.itemTitle}>
                        {m.email}
                        <span
                          className={
                            isDeleted ? styles.tagOff : styles.tagActive
                          }
                        >
                          {isDeleted ? "off" : "active"}
                        </span>
                        {isSelf && <span className={styles.tagYou}>you</span>}
                      </p>
                      <p className={styles.itemMeta}>
                        Joined {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {
                      !isSelf &&
                        <MemberToggle userId={m.id} isDeleted={isDeleted} />
                    }
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}