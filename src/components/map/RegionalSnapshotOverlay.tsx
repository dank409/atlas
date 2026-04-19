import type { BypassModelResult } from "../../utils/bypassModel";
import styles from "./RegionalSnapshotOverlay.module.css";

interface RegionalSnapshotOverlayProps {
  /** Bypass model result when a scenario is engaged, otherwise null. */
  bypassResult: BypassModelResult | null;
  /** Current disruption slider position. 0 = idle, > 0 = scenario live. */
  disruptionPct: number;
  /** Total chokepoint transit (Hormuz baseline) in mbpd. */
  hormuzBaselineMbpd: number;
  /** Number of refineries currently rendered on the map. */
  refineryCount: number;
  /** Number of FIRMS facility anomalies at ELEVATED or ALERT severity. */
  firmsAlertCount: number;
}

interface Row {
  key: string;
  value: string;
  unit?: string;
  tone?: "pos" | "neg" | "warn" | "neutral";
}

/**
 * Absolute-positioned tile in the map's top-right gutter. Shows five
 * regional indicators the bypass-scenario user cares about at a glance:
 * Hormuz flow, scenario disruption %, net deficit after bypass, days
 * to OECD operational minimum, and live FIRMS alerts. When no scenario
 * is engaged the deficit/days rows render as dashes so the tile
 * doesn't lie.
 */
export function RegionalSnapshotOverlay({
  bypassResult,
  disruptionPct,
  hormuzBaselineMbpd,
  refineryCount,
  firmsAlertCount
}: RegionalSnapshotOverlayProps) {
  const rows: Row[] = [
    {
      key: "HORMUZ FLOW",
      value: hormuzBaselineMbpd.toFixed(1),
      unit: "MBPD",
      tone: "neutral"
    },
    {
      key: "SCENARIO DISRUPTION",
      value: disruptionPct > 0 ? `${disruptionPct.toFixed(0)}%` : "--",
      tone: disruptionPct >= 60 ? "neg" : disruptionPct > 0 ? "warn" : "neutral"
    },
    {
      key: "NET DEFICIT",
      value: bypassResult ? bypassResult.netDailyDeficitMbpd.toFixed(2) : "--",
      unit: bypassResult ? "MBPD" : undefined,
      tone: bypassResult && bypassResult.netDailyDeficitMbpd > 0 ? "neg" : "pos"
    },
    {
      key: "DAYS TO OECD MIN",
      value:
        bypassResult && bypassResult.daysToOperationalMinimum !== null
          ? bypassResult.daysToOperationalMinimum.toFixed(1)
          : "--",
      unit:
        bypassResult && bypassResult.daysToOperationalMinimum !== null ? "D" : undefined,
      tone:
        bypassResult &&
        bypassResult.daysToOperationalMinimum !== null &&
        bypassResult.daysToOperationalMinimum < 30
          ? "neg"
          : "neutral"
    },
    {
      key: "REFINERIES",
      value: refineryCount.toString(),
      tone: "neutral"
    },
    {
      key: "FIRMS ALERTS",
      value: firmsAlertCount.toString(),
      tone: firmsAlertCount > 0 ? "warn" : "neutral"
    }
  ];

  return (
    <div aria-label="REGIONAL SNAPSHOT" className={styles.overlay} role="status">
      <div className={styles.title}>REGIONAL SNAPSHOT</div>
      <div className={styles.grid}>
        {rows.map((row) => (
          <div className={styles.row} key={row.key}>
            <span className={styles.label}>{row.key}</span>
            <span className={`${styles.value} ${toneClass(row.tone, styles)}`}>
              {row.value}
            </span>
            {row.unit ? <span className={styles.unit}>{row.unit}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function toneClass(
  tone: Row["tone"],
  stylesMap: Record<string, string>
): string {
  if (tone === "pos") return stylesMap.tonePos;
  if (tone === "neg") return stylesMap.toneNeg;
  if (tone === "warn") return stylesMap.toneWarn;
  return stylesMap.toneNeutral;
}
