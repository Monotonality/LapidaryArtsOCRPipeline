import { notFound } from "next/navigation";
import { AddRecord } from "@/app/add/add-form";
import styles from "@/app/add/add.module.css";

export default function OcrDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className={styles.main}>
      <div className={styles.pageTitle}><h1>OCR demo</h1></div>
      <AddRecord demo />
    </main>
  );
}
