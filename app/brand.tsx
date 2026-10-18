import type { ReactNode } from "react";
import styles from "./auth.module.css";

export function Brand({
  name,
  tagline,
}: {
  name?: ReactNode;
  tagline?: string;
}) {
  return (
    <div className={styles.brand}>
      <span className={styles.mark} aria-hidden="true" />
      <div>
        <p className={styles.brandName}>{name ?? "InkParse"}</p>
        {tagline && <p className={styles.brandTagline}>{tagline}</p>}
      </div>
    </div>
  );
}
