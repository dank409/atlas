import { Panel } from "../common/Panel";
import { Sparkline } from "./Sparkline";
import type { CrudePriceSnapshot, CrudeMarketSummary, DmeOmanSnapshot, MurbanSnapshot } from "../../types/Market";
import styles from "./PriceGridModule.module.css";

interface PriceGridModuleProps {
  summary: CrudeMarketSummary | null;
  brentWtiSnapshot: CrudePriceSnapshot | null;
  dmeOmanSnapshot: DmeOmanSnapshot | null;
  murbanSnapshot: MurbanSnapshot | null;
  mode: "LIVE" | "STATIC_SNAPSHOT";
}

interface Row {
  symbol: "BRENT" | "WTI" | "DME OMAN" | "MURBAN";
  value: number | null;
  change: number | null;
  changePct: number | null;
  series: number[];
}

/**
 * Dense crude-benchmark spot grid — ticker-style row per symbol with
 * last / change / %chg / a 30-point sparkline. Pulls from useCrudePrices
 * so each tile respects live-or-static fallback and matches the mode
 * badge on the header.
 */
export function PriceGridModule({
  summary,
  brentWtiSnapshot,
  dmeOmanSnapshot,
  murbanSnapshot,
  mode
}: PriceGridModuleProps) {
  const brentSeries = tailValues(brentWtiSnapshot?.series.brent);
  const wtiSeries = tailValues(brentWtiSnapshot?.series.wti);
  const dmeSeries = tailValues(dmeOmanSnapshot?.series.dmeOman);
  const murbanSeries = tailValues(murbanSnapshot?.series.murban);

  const rows: Row[] = [
    {
      symbol: "BRENT",
      value: summary?.brent.value ?? null,
      change: summary?.brent.change ?? null,
      changePct: summary?.brent.changePct ?? null,
      series: brentSeries
    },
    {
      symbol: "WTI",
      value: summary?.wti.value ?? null,
      change: summary?.wti.change ?? null,
      changePct: summary?.wti.changePct ?? null,
      series: wtiSeries
    },
    {
      symbol: "DME OMAN",
      value: summary?.dmeOman?.value ?? null,
      change: summary?.dmeOman?.change ?? null,
      changePct: summary?.dmeOman?.changePct ?? null,
      series: dmeSeries
    },
    {
      symbol: "MURBAN",
      value: summary?.murban?.value ?? null,
      change: summary?.murban?.change ?? null,
      changePct: summary?.murban?.changePct ?? null,
      series: murbanSeries
    }
  ];

  return (
    <Panel title="CRUDE · SPOT" badge={mode === "LIVE" ? "LIVE" : "STATIC"}>
      <div className={styles.grid}>
        <div className={styles.headerRow}>
          <span>SYM</span>
          <span className={styles.numericCell}>LAST</span>
          <span className={styles.numericCell}>CHG</span>
          <span className={styles.numericCell}>%</span>
          <span className={styles.sparkHeader}>30D</span>
        </div>
        {rows.map((row) => {
          const chgClass = row.change === null
            ? styles.changeNeutral
            : row.change > 0
              ? styles.changePos
              : row.change < 0
                ? styles.changeNeg
                : styles.changeNeutral;
          const sparkColor = row.change === null
            ? "#666666"
            : row.change >= 0
              ? "#00C853"
              : "#FF1744";
          return (
            <div className={styles.dataRow} key={row.symbol}>
              <span className={styles.symbol}>{row.symbol}</span>
              <span className={styles.numericCell}>{formatNum(row.value, 2)}</span>
              <span className={`${styles.numericCell} ${chgClass}`}>{formatSigned(row.change, 2)}</span>
              <span className={`${styles.numericCell} ${chgClass}`}>{formatSigned(row.changePct, 2, "%")}</span>
              <span className={styles.sparkCell}>
                <Sparkline
                  ariaLabel={`${row.symbol} 30D`}
                  color={sparkColor}
                  height={16}
                  series={row.series}
                  width={72}
                />
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function tailValues(series: Array<{ value: number }> | undefined): number[] {
  if (!series || series.length === 0) return [];
  return series.slice(-30).map((point) => point.value);
}

function formatNum(value: number | null, decimals: number): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toFixed(decimals);
}

function formatSigned(value: number | null, decimals: number, suffix = ""): string {
  if (value === null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}${suffix}`;
}
