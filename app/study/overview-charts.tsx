"use client";

import {
  Children,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import styles from "./study.module.css";

export type TimingPair = {
  label: string;
  controlSec: number | null;
  experimentalSec: number | null;
  pairedAt: string | null;
};

export type ValidationChartRow = {
  corpus_label: string;
  major_correction: boolean;
  validated_at: string;
  wrong_client_name: boolean;
  wrong_phone_number: boolean;
  wrong_date: boolean;
  wrong_date_promised: boolean;
  wrong_instructions: boolean;
  wrong_price: boolean;
  novel_promissory_format: boolean;
};

export type CostPoint = {
  label: string;
  submitted_at: string;
  input_tokens: number;
  output_tokens: number;
};

const FIELD_DEFS = [
  { key: "wrong_client_name", label: "Client name" },
  { key: "wrong_phone_number", label: "Phone" },
  { key: "wrong_date", label: "Date" },
  { key: "wrong_date_promised", label: "Date promised" },
  { key: "wrong_instructions", label: "Instructions" },
  { key: "wrong_price", label: "Price" },
] as const;

type FieldKey = (typeof FIELD_DEFS)[number]["key"];

const INPUT_PRICE = 0.03 / 1_000_000;
const OUTPUT_PRICE = 0.13 / 1_000_000;

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sampleStd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const ss = xs.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(ss / (xs.length - 1));
}

/** 95% CI half-width of the mean. */
function ci95(xs: number[]): number | null {
  const s = sampleStd(xs);
  if (s === null) return null;
  return (1.96 * s) / Math.sqrt(xs.length);
}

function fmtPct(v: number | null, digits = 1): string {
  return v === null ? "n/a" : `${(v * 100).toFixed(digits)}%`;
}

function fmtSec(v: number | null): string {
  return v === null ? "n/a" : `${v.toFixed(1)}s`;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function histogram(values: number[], binCount = 12): { x0: number; x1: number; n: number }[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) {
    return [{ x0: lo, x1: hi + 1, n: values.length }];
  }
  const width = (hi - lo) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: lo + i * width,
    x1: lo + (i + 1) * width,
    n: 0,
  }));
  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - lo) / width));
    bins[idx].n += 1;
  }
  return bins;
}

function Axis({
  width,
  height,
  pad,
  yMax,
  yTicks = 4,
  yFmt = (v: number) => String(v),
}: {
  width: number;
  height: number;
  pad: { t: number; r: number; b: number; l: number };
  yMax: number;
  yTicks?: number;
  yFmt?: (v: number) => string;
}) {
  const innerH = height - pad.t - pad.b;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (yMax * i) / yTicks);
  return (
    <g aria-hidden="true">
      <line
        x1={pad.l}
        x2={pad.l}
        y1={pad.t}
        y2={height - pad.b}
        className={styles.chartAxis}
      />
      <line
        x1={pad.l}
        x2={width - pad.r}
        y1={height - pad.b}
        y2={height - pad.b}
        className={styles.chartAxis}
      />
      {ticks.map((t) => {
        const y = height - pad.b - (t / yMax) * innerH;
        return (
          <g key={t}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y}
              y2={y}
              className={styles.chartGrid}
            />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" className={styles.chartTick}>
              {yFmt(t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ChartCard({
  title,
  help,
  children,
  actions,
}: {
  title: string;
  help?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`${styles.chartCard} ${styles.chartCardFocus}`}>
      <div className={styles.chartCardHead}>
        <div>
          <h3 className={styles.chartCardTitle}>{title}</h3>
          {help ? <p className={styles.chartCardHelp}>{help}</p> : null}
        </div>
        {actions}
      </div>
      <div className={styles.chartStage}>{children}</div>
    </div>
  );
}

function ChartCarousel({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [index, setIndex] = useState(0);

  const go = (dir: -1 | 1) => {
    setIndex((i) => (i + dir + count) % count);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => (i - 1 + count) % count);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => (i + 1) % count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  if (count === 0) return null;

  return (
    <div className={styles.chartCarousel}>
      <div className={styles.chartCarouselBar}>
        <button
          type="button"
          className={styles.chartNavBtn}
          onClick={() => go(-1)}
          aria-label="Previous graph"
        >
          ←
        </button>
        <div className={styles.chartCarouselMeta}>
          <span className={styles.chartCarouselCount}>
            {index + 1} / {count}
          </span>
          <span className={styles.chartCarouselHint}>
            Use ← → keys to move between graphs
          </span>
        </div>
        <button
          type="button"
          className={styles.chartNavBtn}
          onClick={() => go(1)}
          aria-label="Next graph"
        >
          →
        </button>
      </div>
      {slides[index]}
      <div className={styles.chartDots} role="tablist" aria-label="Graphs">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Graph ${i + 1}`}
            className={`${styles.chartDot} ${
              i === index ? styles.chartDotActive : ""
            }`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

export function OverviewCharts({
  pairs,
  validations,
  costs,
  corpusSize,
}: {
  pairs: TimingPair[];
  validations: ValidationChartRow[];
  costs: CostPoint[];
  corpusSize: number;
}) {
  const [excludeNovel, setExcludeNovel] = useState(true);
  const [deltaSort, setDeltaSort] = useState<"label" | "delta-desc" | "delta-asc">(
    "delta-desc",
  );

  const controlSecs = useMemo(
    () => pairs.map((p) => p.controlSec).filter((v): v is number => v !== null),
    [pairs],
  );
  const experimentalSecs = useMemo(
    () =>
      pairs.map((p) => p.experimentalSec).filter((v): v is number => v !== null),
    [pairs],
  );

  const meanControl = mean(controlSecs);
  const meanExperimental = mean(experimentalSecs);
  const ciControl = ci95(controlSecs);
  const ciExperimental = ci95(experimentalSecs);

  const deltas = useMemo(
    () =>
      pairs
        .filter((p) => p.controlSec !== null && p.experimentalSec !== null)
        .map((p) => ({
          label: p.label,
          delta: (p.controlSec as number) - (p.experimentalSec as number),
          pairedAt: p.pairedAt,
        })),
    [pairs],
  );

  const deltaHist = useMemo(
    () => histogram(deltas.map((d) => d.delta), 14),
    [deltas],
  );

  const sortedDeltas = useMemo(() => {
    const rows = [...deltas];
    if (deltaSort === "label") {
      rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    } else if (deltaSort === "delta-desc") {
      rows.sort((a, b) => b.delta - a.delta);
    } else {
      rows.sort((a, b) => a.delta - b.delta);
    }
    return rows;
  }, [deltas, deltaSort]);

  const runningSpeed = useMemo(() => {
    const ordered = [...deltas].sort((a, b) => {
      const ta = a.pairedAt ?? "";
      const tb = b.pairedAt ?? "";
      return ta.localeCompare(tb);
    });
    let sumC = 0;
    let sumE = 0;
    const out: { n: number; improvement: number }[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const p = pairs.find((x) => x.label === ordered[i].label);
      if (!p || p.controlSec === null || p.experimentalSec === null) continue;
      sumC += p.controlSec;
      sumE += p.experimentalSec;
      const n = i + 1;
      const mC = sumC / n;
      const mE = sumE / n;
      out.push({ n, improvement: mC > 0 ? (mC - mE) / mC : 0 });
    }
    return out;
  }, [deltas, pairs]);

  const progress = useMemo(() => {
    const ordered = [...validations].sort((a, b) =>
      a.validated_at.localeCompare(b.validated_at),
    );
    return ordered.map((v, i) => ({
      n: i + 1,
      at: v.validated_at,
      pending: Math.max(0, corpusSize - (i + 1)),
    }));
  }, [validations, corpusSize]);

  const costSeries = useMemo(() => {
    const ordered = [...costs].sort((a, b) =>
      a.submitted_at.localeCompare(b.submitted_at),
    );
    let cumCost = 0;
    let cumIn = 0;
    let cumOut = 0;
    return ordered.map((c, i) => {
      cumIn += c.input_tokens;
      cumOut += c.output_tokens;
      cumCost += c.input_tokens * INPUT_PRICE + c.output_tokens * OUTPUT_PRICE;
      return { n: i + 1, cost: cumCost, input: cumIn, output: cumOut };
    });
  }, [costs]);

  const fieldStats = useMemo(() => {
    const n = validations.length;
    return FIELD_DEFS.map((f) => {
      let wrong = 0;
      let novelWrong = 0;
      for (const v of validations) {
        const isWrong = v[f.key as FieldKey];
        if (!isWrong) continue;
        if (f.key === "wrong_date_promised" && v.novel_promissory_format) {
          novelWrong += 1;
        } else {
          wrong += 1;
        }
      }
      const totalWrong = wrong + novelWrong;
      return {
        label: f.label,
        key: f.key,
        wrong,
        novelWrong,
        totalWrong,
        share: n > 0 ? totalWrong / n : 0,
        shareExclNovel:
          n > 0
            ? f.key === "wrong_date_promised"
              ? wrong / n
              : totalWrong / n
            : 0,
      };
    });
  }, [validations]);

  const fieldAccuracy = useMemo(() => {
    let slotsIncl = 0;
    let wrongIncl = 0;
    let slotsExcl = 0;
    let wrongExcl = 0;
    for (const v of validations) {
      const flags: boolean[] = [
        v.wrong_client_name,
        v.wrong_phone_number,
        v.wrong_date,
        v.wrong_date_promised,
        v.wrong_instructions,
        v.wrong_price,
      ];
      slotsIncl += flags.length;
      wrongIncl += flags.filter(Boolean).length;
      if (v.novel_promissory_format) {
        const excl = [
          v.wrong_client_name,
          v.wrong_phone_number,
          v.wrong_date,
          v.wrong_instructions,
          v.wrong_price,
        ];
        slotsExcl += excl.length;
        wrongExcl += excl.filter(Boolean).length;
      } else {
        slotsExcl += flags.length;
        wrongExcl += flags.filter(Boolean).length;
      }
    }
    return {
      incl: slotsIncl > 0 ? 1 - wrongIncl / slotsIncl : null,
      excl: slotsExcl > 0 ? 1 - wrongExcl / slotsExcl : null,
      correctIncl: slotsIncl - wrongIncl,
      slotsIncl,
      correctExcl: slotsExcl - wrongExcl,
      slotsExcl,
    };
  }, [validations]);

  const majorCount = validations.filter((v) => v.major_correction).length;
  const acceptableCount = validations.length - majorCount;

  const novelToggle = (
    <label className={styles.chartToggle}>
      <input
        type="checkbox"
        checked={excludeNovel}
        onChange={(e) => setExcludeNovel(e.target.checked)}
      />
      Exclude novel date promised
    </label>
  );

  const meanYMax = niceMax(
    Math.max(
      (meanControl ?? 0) + (ciControl ?? 0),
      (meanExperimental ?? 0) + (ciExperimental ?? 0),
      1,
    ),
  );

  return (
    <ChartCarousel>
      <ChartCard
        title="Mean time ± 95% CI"
        help="Control vs experimental open-to-submit duration."
      >
        {controlSecs.length === 0 && experimentalSecs.length === 0 ? (
          <p className={styles.empty}>No timing data yet.</p>
        ) : (
          <svg
            viewBox="0 0 420 220"
            className={styles.chartSvg}
            role="img"
            aria-label="Mean control and experimental times with 95 percent confidence intervals"
          >
            <Axis
              width={420}
              height={220}
              pad={{ t: 16, r: 16, b: 36, l: 44 }}
              yMax={meanYMax}
              yFmt={(v) => `${v.toFixed(0)}`}
            />
            {[
              {
                label: "Control",
                mean: meanControl,
                ci: ciControl,
                x: 130,
                cls: styles.chartBarControl,
              },
              {
                label: "Experimental",
                mean: meanExperimental,
                ci: ciExperimental,
                x: 260,
                cls: styles.chartBarExperimental,
              },
            ].map((bar) => {
              if (bar.mean === null) return null;
              const pad = { t: 16, b: 36 };
              const innerH = 220 - pad.t - pad.b;
              const y = pad.t + innerH * (1 - bar.mean / meanYMax);
              const h = innerH * (bar.mean / meanYMax);
              const ci = bar.ci ?? 0;
              const yLo = pad.t + innerH * (1 - Math.min(meanYMax, bar.mean + ci) / meanYMax);
              const yHi = pad.t + innerH * (1 - Math.max(0, bar.mean - ci) / meanYMax);
              return (
                <g key={bar.label}>
                  <rect
                    x={bar.x}
                    y={y}
                    width={48}
                    height={h}
                    className={bar.cls}
                    rx={2}
                  />
                  {bar.ci !== null && (
                    <>
                      <line
                        x1={bar.x + 24}
                        x2={bar.x + 24}
                        y1={yLo}
                        y2={yHi}
                        className={styles.chartWhisker}
                      />
                      <line
                        x1={bar.x + 16}
                        x2={bar.x + 32}
                        y1={yLo}
                        y2={yLo}
                        className={styles.chartWhisker}
                      />
                      <line
                        x1={bar.x + 16}
                        x2={bar.x + 32}
                        y1={yHi}
                        y2={yHi}
                        className={styles.chartWhisker}
                      />
                    </>
                  )}
                  <text
                    x={bar.x + 24}
                    y={208}
                    textAnchor="middle"
                    className={styles.chartTick}
                  >
                    {bar.label}
                  </text>
                  <text
                    x={bar.x + 24}
                    y={y - 6}
                    textAnchor="middle"
                    className={styles.chartValue}
                  >
                    {fmtSec(bar.mean)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <p className={styles.chartFoot}>
          n<sub>c</sub>={controlSecs.length}, n<sub>e</sub>={experimentalSecs.length}
          {meanControl !== null &&
            meanExperimental !== null &&
            meanControl > 0 && (
              <>
                {" "}
                · improvement{" "}
                {fmtPct((meanControl - meanExperimental) / meanControl)}
              </>
            )}
        </p>
      </ChartCard>

      <ChartCard
        title="Speed delta distribution"
        help="Per-record control − experimental (seconds saved). Right of zero means OCR was faster."
      >
        {deltas.length === 0 ? (
          <p className={styles.empty}>Need paired control + experimental rows.</p>
        ) : (
          <svg
            viewBox="0 0 420 220"
            className={styles.chartSvg}
            role="img"
            aria-label="Histogram of per-record time savings"
          >
            {(() => {
              const pad = { t: 16, r: 16, b: 40, l: 36 };
              const innerW = 420 - pad.l - pad.r;
              const innerH = 220 - pad.t - pad.b;
              const maxN = Math.max(...deltaHist.map((b) => b.n), 1);
              const yMax = niceMax(maxN);
              const zero =
                deltaHist[0].x0 < 0 && deltaHist[deltaHist.length - 1].x1 > 0
                  ? pad.l +
                    ((0 - deltaHist[0].x0) /
                      (deltaHist[deltaHist.length - 1].x1 - deltaHist[0].x0)) *
                      innerW
                  : null;
              return (
                <>
                  <Axis
                    width={420}
                    height={220}
                    pad={pad}
                    yMax={yMax}
                    yFmt={(v) => `${Math.round(v)}`}
                  />
                  {zero !== null && (
                    <line
                      x1={zero}
                      x2={zero}
                      y1={pad.t}
                      y2={220 - pad.b}
                      className={styles.chartZero}
                    />
                  )}
                  {deltaHist.map((b, i) => {
                    const x = pad.l + (i / deltaHist.length) * innerW;
                    const w = innerW / deltaHist.length - 2;
                    const h = (b.n / yMax) * innerH;
                    const y = 220 - pad.b - h;
                    return (
                      <rect
                        key={i}
                        x={x}
                        y={y}
                        width={Math.max(w, 1)}
                        height={h}
                        className={
                          b.x1 <= 0
                            ? styles.chartBarNeg
                            : b.x0 >= 0
                              ? styles.chartBarPos
                              : styles.chartBarMixed
                        }
                      >
                        <title>
                          {b.x0.toFixed(1)}–{b.x1.toFixed(1)}s: {b.n}
                        </title>
                      </rect>
                    );
                  })}
                  <text x={pad.l} y={212} className={styles.chartTick}>
                    {deltaHist[0].x0.toFixed(0)}s
                  </text>
                  <text
                    x={420 - pad.r}
                    y={212}
                    textAnchor="end"
                    className={styles.chartTick}
                  >
                    {deltaHist[deltaHist.length - 1].x1.toFixed(0)}s
                  </text>
                </>
              );
            })()}
          </svg>
        )}
        <p className={styles.chartFoot}>
          {deltas.length} paired records · mean delta{" "}
          {fmtSec(mean(deltas.map((d) => d.delta)))}
        </p>
      </ChartCard>

      <ChartCard
        title="Per-record speed deltas"
        help="Lollipop of control − experimental for each paired label."
        actions={
          <label className={styles.chartToggle}>
            Sort{" "}
            <select
              className={styles.select}
              value={deltaSort}
              onChange={(e) =>
                setDeltaSort(e.target.value as typeof deltaSort)
              }
            >
              <option value="delta-desc">Saved most</option>
              <option value="delta-asc">Saved least</option>
              <option value="label">Label</option>
            </select>
          </label>
        }
      >
        {sortedDeltas.length === 0 ? (
          <p className={styles.empty}>Need paired rows.</p>
        ) : (
          <div className={styles.chartScroll}>
            <svg
              viewBox={`0 0 ${Math.max(420, sortedDeltas.length * 8 + 60)} 200`}
              width={Math.max(420, sortedDeltas.length * 8 + 60)}
              height={200}
              className={styles.chartSvgWide}
              role="img"
              aria-label="Lollipop chart of per-record time savings"
            >
              {(() => {
                const pad = { t: 12, r: 12, b: 28, l: 40 };
                const absMax = Math.max(
                  ...sortedDeltas.map((d) => Math.abs(d.delta)),
                  1,
                );
                const yMax = niceMax(absMax);
                const innerH = 200 - pad.t - pad.b;
                const mid = pad.t + innerH / 2;
                const scale = innerH / 2 / yMax;
                const step = Math.max(6, (sortedDeltas.length > 0
                  ? (Math.max(420, sortedDeltas.length * 8 + 60) - pad.l - pad.r) /
                    sortedDeltas.length
                  : 6));
                return (
                  <>
                    <line
                      x1={pad.l}
                      x2={Math.max(420, sortedDeltas.length * 8 + 60) - pad.r}
                      y1={mid}
                      y2={mid}
                      className={styles.chartZero}
                    />
                    <text x={pad.l - 4} y={pad.t + 8} textAnchor="end" className={styles.chartTick}>
                      +{yMax.toFixed(0)}
                    </text>
                    <text x={pad.l - 4} y={200 - pad.b} textAnchor="end" className={styles.chartTick}>
                      −{yMax.toFixed(0)}
                    </text>
                    {sortedDeltas.map((d, i) => {
                      const x = pad.l + i * step + step / 2;
                      const y = mid - d.delta * scale;
                      return (
                        <g key={d.label}>
                          <line
                            x1={x}
                            x2={x}
                            y1={mid}
                            y2={y}
                            className={
                              d.delta >= 0
                                ? styles.chartLollipopPos
                                : styles.chartLollipopNeg
                            }
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r={2.5}
                            className={
                              d.delta >= 0
                                ? styles.chartDotPos
                                : styles.chartDotNeg
                            }
                          >
                            <title>
                              {d.label}: {d.delta.toFixed(1)}s
                            </title>
                          </circle>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Running speed improvement"
        help="Mean improvement (control − experimental) / control as paired n grows."
      >
        {runningSpeed.length < 2 ? (
          <p className={styles.empty}>Need at least two paired records.</p>
        ) : (
          <svg
            viewBox="0 0 420 220"
            className={styles.chartSvg}
            role="img"
            aria-label="Running mean speed improvement versus sample size"
          >
            {(() => {
              const pad = { t: 16, r: 16, b: 36, l: 44 };
              const innerW = 420 - pad.l - pad.r;
              const innerH = 220 - pad.t - pad.b;
              const yMax = niceMax(
                Math.max(...runningSpeed.map((p) => Math.abs(p.improvement)), 0.1),
              );
              const span = yMax * 2;
              const xOf = (n: number) =>
                pad.l + ((n - 1) / Math.max(runningSpeed.length - 1, 1)) * innerW;
              const yOf = (v: number) =>
                pad.t + ((yMax - v) / span) * innerH;
              const zeroY = yOf(0);
              const d = runningSpeed
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"}${xOf(p.n).toFixed(1)},${yOf(p.improvement).toFixed(1)}`,
                )
                .join(" ");
              const ticks = [-yMax, -yMax / 2, 0, yMax / 2, yMax];
              return (
                <>
                  <line
                    x1={pad.l}
                    x2={pad.l}
                    y1={pad.t}
                    y2={220 - pad.b}
                    className={styles.chartAxis}
                  />
                  <line
                    x1={pad.l}
                    x2={420 - pad.r}
                    y1={220 - pad.b}
                    y2={220 - pad.b}
                    className={styles.chartAxis}
                  />
                  {ticks.map((t) => (
                    <g key={t}>
                      <line
                        x1={pad.l}
                        x2={420 - pad.r}
                        y1={yOf(t)}
                        y2={yOf(t)}
                        className={styles.chartGrid}
                      />
                      <text
                        x={pad.l - 6}
                        y={yOf(t) + 3}
                        textAnchor="end"
                        className={styles.chartTick}
                      >
                        {(t * 100).toFixed(0)}%
                      </text>
                    </g>
                  ))}
                  <line
                    x1={pad.l}
                    x2={420 - pad.r}
                    y1={zeroY}
                    y2={zeroY}
                    className={styles.chartZero}
                  />
                  <path d={d} className={styles.chartLine} fill="none" />
                  <text x={pad.l} y={212} className={styles.chartTick}>
                    n=1
                  </text>
                  <text
                    x={420 - pad.r}
                    y={212}
                    textAnchor="end"
                    className={styles.chartTick}
                  >
                    n={runningSpeed.length}
                  </text>
                  <text
                    x={xOf(runningSpeed[runningSpeed.length - 1].n)}
                    y={yOf(runningSpeed[runningSpeed.length - 1].improvement) - 8}
                    textAnchor="end"
                    className={styles.chartValue}
                  >
                    {fmtPct(runningSpeed[runningSpeed.length - 1].improvement)}
                  </text>
                </>
              );
            })()}
          </svg>
        )}
      </ChartCard>

      <ChartCard
        title="Audit progress"
        help="Cumulative audited records over validation order; remainder is pending corpus."
      >
        {progress.length === 0 ? (
          <p className={styles.empty}>No audits yet.</p>
        ) : (
          <svg
            viewBox="0 0 420 220"
            className={styles.chartSvg}
            role="img"
            aria-label="Cumulative audited versus pending records"
          >
            {(() => {
              const pad = { t: 16, r: 16, b: 36, l: 44 };
              const innerW = 420 - pad.l - pad.r;
              const innerH = 220 - pad.t - pad.b;
              const yMax = niceMax(corpusSize);
              const xOf = (n: number) =>
                pad.l + ((n - 1) / Math.max(progress.length - 1, 1)) * innerW;
              const yOf = (v: number) => pad.t + innerH * (1 - v / yMax);
              const audited = progress
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"}${xOf(p.n).toFixed(1)},${yOf(p.n).toFixed(1)}`,
                )
                .join(" ");
              return (
                <>
                  <Axis
                    width={420}
                    height={220}
                    pad={pad}
                    yMax={yMax}
                    yFmt={(v) => `${Math.round(v)}`}
                  />
                  <line
                    x1={pad.l}
                    x2={420 - pad.r}
                    y1={yOf(corpusSize)}
                    y2={yOf(corpusSize)}
                    className={styles.chartGoal}
                  />
                  <path d={audited} className={styles.chartLine} fill="none" />
                  <text x={pad.l} y={212} className={styles.chartTick}>
                    first audit
                  </text>
                  <text
                    x={420 - pad.r}
                    y={212}
                    textAnchor="end"
                    className={styles.chartTick}
                  >
                    {progress.length} audited · {corpusSize - progress.length} pending
                  </text>
                </>
              );
            })()}
          </svg>
        )}
      </ChartCard>

      <ChartCard
        title="Cumulative API cost"
        help="Running OCR cost from logged experimental tokens ($0.03/1M in, $0.13/1M out)."
      >
        {costSeries.length === 0 ? (
          <p className={styles.empty}>No experimental token logs yet.</p>
        ) : (
          <svg
            viewBox="0 0 420 220"
            className={styles.chartSvg}
            role="img"
            aria-label="Cumulative API cost versus experimental records"
          >
            {(() => {
              const pad = { t: 16, r: 16, b: 36, l: 52 };
              const innerW = 420 - pad.l - pad.r;
              const innerH = 220 - pad.t - pad.b;
              const yMax = niceMax(costSeries[costSeries.length - 1].cost || 0.0001);
              const xOf = (n: number) =>
                pad.l + ((n - 1) / Math.max(costSeries.length - 1, 1)) * innerW;
              const yOf = (v: number) => pad.t + innerH * (1 - v / yMax);
              const d = costSeries
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"}${xOf(p.n).toFixed(1)},${yOf(p.cost).toFixed(1)}`,
                )
                .join(" ");
              return (
                <>
                  <Axis
                    width={420}
                    height={220}
                    pad={pad}
                    yMax={yMax}
                    yFmt={(v) => `$${v.toFixed(v < 0.01 ? 4 : 3)}`}
                  />
                  <path d={d} className={styles.chartLinePurple} fill="none" />
                  <text
                    x={420 - pad.r}
                    y={yOf(costSeries[costSeries.length - 1].cost) - 8}
                    textAnchor="end"
                    className={styles.chartValue}
                  >
                    ${costSeries[costSeries.length - 1].cost.toFixed(5)}
                  </text>
                  <text x={pad.l} y={212} className={styles.chartTick}>
                    1 record
                  </text>
                  <text
                    x={420 - pad.r}
                    y={212}
                    textAnchor="end"
                    className={styles.chartTick}
                  >
                    {costSeries.length} records
                  </text>
                </>
              );
            })()}
          </svg>
        )}
      </ChartCard>

      <ChartCard
        title="Record verdict"
        help="Share of audited records marked acceptable vs major correction."
      >
        {validations.length === 0 ? (
          <p className={styles.empty}>No audits yet.</p>
        ) : (
          <div className={styles.stackedBarWrap}>
            <div
              className={styles.stackedBar}
              role="img"
              aria-label={`${acceptableCount} acceptable, ${majorCount} major correction`}
            >
              <div
                className={styles.stackedAcceptable}
                style={{
                  width: `${(acceptableCount / validations.length) * 100}%`,
                }}
                title={`Acceptable: ${acceptableCount}`}
              />
              <div
                className={styles.stackedMajor}
                style={{
                  width: `${(majorCount / validations.length) * 100}%`,
                }}
                title={`Major correction: ${majorCount}`}
              />
            </div>
            <div className={styles.chartLegend}>
              <span>
                <i className={`${styles.swatch} ${styles.swatchGreen}`} />
                Acceptable {acceptableCount} ({fmtPct(acceptableCount / validations.length)})
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.swatchDanger}`} />
                Major {majorCount} ({fmtPct(majorCount / validations.length)})
              </span>
            </div>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Field accuracy"
        help="Correct field slots / all field slots. Toggle drops novel-format date promised."
        actions={novelToggle}
      >
        {validations.length === 0 ? (
          <p className={styles.empty}>No audits yet.</p>
        ) : (
          <>
            <svg
              viewBox="0 0 420 160"
              className={styles.chartSvg}
              role="img"
              aria-label="Field accuracy including versus excluding novel date promised"
            >
              {(() => {
                const pad = { t: 20, r: 16, b: 36, l: 44 };
                const innerH = 160 - pad.t - pad.b;
                const active = excludeNovel
                  ? fieldAccuracy.excl
                  : fieldAccuracy.incl;
                const correct = excludeNovel
                  ? fieldAccuracy.correctExcl
                  : fieldAccuracy.correctIncl;
                const slots = excludeNovel
                  ? fieldAccuracy.slotsExcl
                  : fieldAccuracy.slotsIncl;
                const h = (active ?? 0) * innerH;
                const y = pad.t + innerH - h;
                return (
                  <>
                    <Axis
                      width={420}
                      height={160}
                      pad={pad}
                      yMax={1}
                      yTicks={4}
                      yFmt={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <rect
                      x={160}
                      y={y}
                      width={100}
                      height={h}
                      className={styles.chartBarControl}
                      rx={2}
                    />
                    <text
                      x={210}
                      y={y - 6}
                      textAnchor="middle"
                      className={styles.chartValue}
                    >
                      {fmtPct(active)}
                    </text>
                    <text
                      x={210}
                      y={148}
                      textAnchor="middle"
                      className={styles.chartTick}
                    >
                      {excludeNovel ? "Excl. novel" : "Incl. novel"}
                    </text>
                    <text x={280} y={pad.t + 14} className={styles.chartTick}>
                      {correct} / {slots} correct
                    </text>
                    <text x={280} y={pad.t + 30} className={styles.chartTick}>
                      alt {fmtPct(excludeNovel ? fieldAccuracy.incl : fieldAccuracy.excl)}{" "}
                      {excludeNovel ? "incl." : "excl."}
                    </text>
                  </>
                );
              })()}
            </svg>
          </>
        )}
      </ChartCard>

      <ChartCard
        title="Field-level errors"
        help="Wrong-mark rate per field. Date promised splits novel format as a second segment."
        actions={novelToggle}
      >
        {validations.length === 0 ? (
          <p className={styles.empty}>No audits yet.</p>
        ) : (
          <svg
            viewBox="0 0 420 240"
            className={styles.chartSvg}
            role="img"
            aria-label="Bar chart of field-level error rates"
          >
            {(() => {
              const pad = { t: 16, r: 16, b: 48, l: 44 };
              const innerW = 420 - pad.l - pad.r;
              const innerH = 240 - pad.t - pad.b;
              const yMax = 1;
              const gap = 10;
              const barW = (innerW - gap * (fieldStats.length - 1)) / fieldStats.length;
              return (
                <>
                  <Axis
                    width={420}
                    height={240}
                    pad={pad}
                    yMax={yMax}
                    yTicks={4}
                    yFmt={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                  {fieldStats.map((f, i) => {
                    const x = pad.l + i * (barW + gap);
                    const mainShare = excludeNovel
                      ? f.key === "wrong_date_promised"
                        ? f.wrong / validations.length
                        : f.share
                      : f.share;
                    const novelShare =
                      !excludeNovel && f.key === "wrong_date_promised"
                        ? f.novelWrong / validations.length
                        : 0;
                    const mainH = mainShare * innerH;
                    const novelH = novelShare * innerH;
                    const yMain = 240 - pad.b - mainH - novelH;
                    return (
                      <g key={f.key}>
                        <rect
                          x={x}
                          y={yMain}
                          width={barW}
                          height={mainH}
                          className={styles.chartBarDanger}
                          rx={1}
                        >
                          <title>
                            {f.label}: {(mainShare * 100).toFixed(1)}%
                          </title>
                        </rect>
                        {novelH > 0 && (
                          <rect
                            x={x}
                            y={yMain + mainH}
                            width={barW}
                            height={novelH}
                            className={styles.chartBarNovel}
                            rx={1}
                          >
                            <title>
                              {f.label} novel: {(novelShare * 100).toFixed(1)}%
                            </title>
                          </rect>
                        )}
                        <text
                          x={x + barW / 2}
                          y={228}
                          textAnchor="middle"
                          className={styles.chartTickSmall}
                        >
                          {f.label.split(" ")[0]}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
        )}
        <div className={styles.chartLegend}>
          <span>
            <i className={`${styles.swatch} ${styles.swatchDanger}`} />
            Wrong
          </span>
          <span>
            <i className={`${styles.swatch} ${styles.swatchNovel}`} />
            Novel date promised
          </span>
        </div>
      </ChartCard>

      <ChartCard
        title="All records · control vs experimental"
        help="Dual bars for every corpus label with timing. Scroll horizontally."
      >
        {pairs.every((p) => p.controlSec === null && p.experimentalSec === null) ? (
          <p className={styles.empty}>No timing rows.</p>
        ) : (
          <div className={styles.chartScroll}>
            <svg
              width={Math.max(640, pairs.length * 10 + 50)}
              height={320}
              viewBox={`0 0 ${Math.max(640, pairs.length * 10 + 50)} 320`}
              className={styles.chartSvgWide}
              role="img"
              aria-label="Control and experimental times for every corpus label"
            >
              {(() => {
                const ordered = [...pairs].sort((a, b) =>
                  a.label.localeCompare(b.label, undefined, { numeric: true }),
                );
                const pad = { t: 16, r: 8, b: 36, l: 40 };
                const maxT = niceMax(
                  Math.max(
                    ...ordered.flatMap((p) => [
                      p.controlSec ?? 0,
                      p.experimentalSec ?? 0,
                    ]),
                    1,
                  ),
                );
                const innerH = 320 - pad.t - pad.b;
                const groupW = 10;
                return (
                  <>
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                      const y = pad.t + innerH * (1 - t);
                      return (
                        <g key={t}>
                          <line
                            x1={pad.l}
                            x2={Math.max(640, pairs.length * 10 + 50) - pad.r}
                            y1={y}
                            y2={y}
                            className={styles.chartGrid}
                          />
                          <text
                            x={pad.l - 4}
                            y={y + 3}
                            textAnchor="end"
                            className={styles.chartTick}
                          >
                            {(maxT * t).toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                    {ordered.map((p, i) => {
                      const x = pad.l + i * groupW;
                      const cH = ((p.controlSec ?? 0) / maxT) * innerH;
                      const eH = ((p.experimentalSec ?? 0) / maxT) * innerH;
                      return (
                        <g key={p.label}>
                          <rect
                            x={x}
                            y={320 - pad.b - cH}
                            width={3}
                            height={cH}
                            className={styles.chartBarControl}
                          >
                            <title>
                              {p.label} control: {fmtSec(p.controlSec)}
                            </title>
                          </rect>
                          <rect
                            x={x + 4}
                            y={320 - pad.b - eH}
                            width={3}
                            height={eH}
                            className={styles.chartBarExperimental}
                          >
                            <title>
                              {p.label} experimental: {fmtSec(p.experimentalSec)}
                            </title>
                          </rect>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
            <div className={styles.chartLegend}>
              <span>
                <i className={`${styles.swatch} ${styles.swatchControl}`} />
                Control
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.swatchExperimental}`} />
                Experimental
              </span>
            </div>
          </div>
        )}
      </ChartCard>
    </ChartCarousel>
  );
}
