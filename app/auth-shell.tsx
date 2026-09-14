import type { ReactNode } from "react";
import styles from "@/app/auth.module.css";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <main className={styles.auth}>
      <div className={styles.stage}>
        <aside className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelGem} aria-hidden="true" />
            <p className={styles.panelName}>
              Lapidary <em>Arts</em> Records
            </p>
          </div>

          <div className={styles.panelBody}>
            <p className={styles.panelEyebrow}>Archived job cards</p>
            <p className={styles.panelCopy}>
              Handwritten invoices, typed up — record by record.
            </p>
          </div>

          <p className={styles.panelFooter}>
            New signups stay hidden until an existing member
            <br />
            approves them.
          </p>
        </aside>

        <section className={styles.card}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}