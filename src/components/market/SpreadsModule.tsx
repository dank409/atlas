import { Panel } from "../common/Panel";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary
} from "../../types/Market";
import styles from "./SpreadsModule.module.css";

interface SpreadsModuleProps {
  summary: CrudeMarketSummary | null;
  timespreads: BrentTimespreadSnapshot | null;
}

interface SpreadRow {
  label: string;
  value: number | null;
  structure?: "BACKWARDATION" | "CONTANGO" | "FLAT";
}

/**
 * Benchmark and calendar spreads in one dense stack. The top block
 * is benchmark-vs-benchmark (Brent/WTI, Brent/Oman); the bottom block
 * is Brent calendar (M1–M2, M1–M6, M1–M12). Structure label surfaces
 * the ICE snapshot's classification so the user sees at a glance
 * whether paper markets agree with the physical deficit model.
 */
export function SpreadsModule({ summary, timespreads }: SpreadsModuleProps) {
  const benchmarkSpreads: SpreadRow[] = [
    { label: "BRENT · WTI", value: summary?.brentWtiSpread ?? null },
    { label: "BRENT · DME OMAN", value: summary?.brentDmeOmanSpread ?? null }
  ];

  const calendarSpreads: SpreadRow[] = timespreads
    ? [
        { label: "BRENT M1 · M2", value: timespreads.m1MinusM2, structure: timespreads.structure },
        { label: "BRENT M1 · M6", value: timespreads.m1MinusM6 },
        { label: "BRENT M1 · M12", value: timespreads.m1MinusM12 }
      ]
    : [];

  return (
    <Panel title="SPREADS · STRUCTURE" badge="USD/BBL">
      <div className={styles.section}>
        <div className={styles.sectionLabel}>BENCHMARK</div>
        {benchmarkSpreads.map((row) => (
          <SpreadRowView key={row.label} row={row} />
        ))}
      </div>
      {calendarSpreads.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>CALENDAR</div>
          {calendarSpreads.map((row) => (
            <SpreadRowView key={row.label} row={row} />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function SpreadRowView({ row }: { row: SpreadRow }) {
  const chgClass = row.value === null
    ? styles.valueNeutral
    : row.value > 0
      ? styles.valuePos
      : row.value < 0
        ? styles.valueNeg
        : styles.valueNeutral;
  return (
    <div className={styles.row}>
      <span className={styles.label}>{row.label}</span>
      <span className={`${styles.value} ${chgClass}`}>{formatSigned(row.value)}</span>
      <span className={styles.structure}>{row.structure ?? ""}</span>
    </div>
  );
}

function formatSigned(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}
