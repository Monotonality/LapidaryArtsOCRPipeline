import type { ReactNode } from "react";
import Image from "next/image";
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
      <div>
        {name ? (
          <p className={styles.brandName}>{name}</p>
        ) : (
          <Image
            src="/brand/inkparse-wordmark.png"
            alt="InkParse"
            width={705}
            height={180}
            priority
            className={styles.wordmark}
          />
        )}
        {tagline && <p className={styles.brandTagline}>{tagline}</p>}
      </div>
    </div>
  );
}
