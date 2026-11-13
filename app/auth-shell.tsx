import type { ReactNode } from "react";
import Image from "next/image";
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
            <Image
              src="/brand/inkparse-wordmark.png"
              alt="InkParse"
              width={705}
              height={180}
              priority
              className={styles.panelWordmark}
            />
          </div>

          <div className={styles.panelBody}>
            <p className={styles.panelEyebrow}>Record digitization</p>
            <p className={styles.panelCopy}>
              Handwritten job cards, typed up and verified, one record at a time.
            </p>
          </div>

          <p className={styles.panelFooter}>
            Accounts are created by a team member,
            <br />
            so everyone on the ledger is known.
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
