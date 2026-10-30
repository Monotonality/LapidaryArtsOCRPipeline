"use client";

import { useState, type ReactNode } from "react";
import styles from "./study.module.css";

type Tab = "data" | "graphs";

export function OverviewPanel({
  data,
  graphs,
}: {
  data: ReactNode;
  graphs: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("data");

  return (
    <div className={styles.overviewPanel}>
      <div className={styles.overviewTabs} role="tablist" aria-label="Overview view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "data"}
          className={`${styles.overviewTab} ${
            tab === "data" ? styles.overviewTabActive : ""
          }`}
          onClick={() => setTab("data")}
        >
          Data
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "graphs"}
          className={`${styles.overviewTab} ${
            tab === "graphs" ? styles.overviewTabActive : ""
          }`}
          onClick={() => setTab("graphs")}
        >
          Graphs
        </button>
      </div>

      <div
        role="tabpanel"
        hidden={tab !== "data"}
        className={styles.overviewTabPanel}
      >
        {tab === "data" ? data : null}
      </div>
      <div
        role="tabpanel"
        hidden={tab !== "graphs"}
        className={styles.overviewTabPanel}
      >
        {tab === "graphs" ? graphs : null}
      </div>
    </div>
  );
}
