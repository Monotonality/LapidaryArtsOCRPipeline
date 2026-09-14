import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/app/navbar";
import { EditRecordForm } from "../edit-form";
import styles from "./edit.module.css";

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const { count: approvedCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  const isApproved =
    approvedCount && approvedCount > 0
      ? myProfile?.status === "approved"
      : true;

  if (!isApproved) {
    redirect("/login?status=pending");
  }

  const { data: record } = await supabase
    .from("records")
    .select(
      "id, client_name, phone_number, date, date_promised, instructions, price",
    )
    .eq("id", id)
    .maybeSingle();

  if (!record) {
    redirect("/dashboard");
  }

  return (
    <>
      <Navbar email={user.email ?? ""} />

      <main className={styles.main}>
        <div className={styles.pageTitle}>
          <h1>Edit record</h1>
        </div>

        <EditRecordForm
          recordId={record.id}
          initial={{
            client_name: record.client_name ?? "",
            phone_number: record.phone_number ?? "",
            date: record.date ?? "",
            date_promised: record.date_promised ?? "",
            instructions: record.instructions ?? "",
            price: record.price ?? "",
          }}
        />
      </main>
    </>
  );
}