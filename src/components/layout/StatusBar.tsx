import type { TerminalActivityEntry } from "../../types/Activity";
import type { CrudeMarketSummary } from "../../types/Market";
import { formatPrice } from "../../utils/marketSummary";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  activeAssetCount: number;
  activeDatasetCount: number;
  hasError: boolean;
  lastUpdate: string;
  /**
   * Most recent activity log entry. When supplied, the status bar
   * renders a "LAST:" ticker showing the latest action the user
   * took — satisfies the CLAUDE.md "every action leaves a trace"
   * UX principle without spending a full dashboard tile on it.
   */
  latestActivity?: TerminalActivityEntry | null;
  marketSummary: CrudeMarketSummary | null;
  sourceCount: number;
}

export function StatusBar({
  activeAssetCount,
  activeDatasetCount,
  hasError,
  lastUpdate,
  latestActivity = null,
  marketSummary,
  sourceCount
}: StatusBarProps) {
  const status = hasError ? "OFFLINE" : "CONNECTED";
  const dotClassName = hasError ? styles.offline : styles.connected;
  const eiaLabel = marketSummary
    ? `EIA: BRENT ${formatPrice(marketSummary.brent.value)} · ${marketSummary.asOf}`
    : "EIA: --";

  return (
    <div className={styles.statusBar}>
      <div className={styles.item}>
        <span className={`${styles.dot} ${dotClassName}`} />
        <span>{status}</span>
      </div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>REGION: MIDDLE EAST</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>{eiaLabel}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>DATASETS: {activeDatasetCount}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>VISIBLE ASSETS: {activeAssetCount}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>LAST UPDATE: {lastUpdate}</div>
      {latestActivity ? (
        <>
          <span className={styles.separator}>·</span>
          <div className={`${styles.item} ${styles.activityTrace}`}>
            LAST: {latestActivity.timestamp} {latestActivity.label}
          </div>
        </>
      ) : null}
      <div className={styles.itemRight}>SOURCES: {hasError ? "0" : sourceCount} ACTIVE</div>
    </div>
  );
}
