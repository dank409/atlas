import type { TerminalActivityEntry } from "../../types/Activity";
import type { FirmsSnapshot } from "../../types/firms";
import type { CrudeMarketSummary } from "../../types/Market";
import {
  formatCadenceLabel,
  formatClassificationLabel
} from "../../types/DataSource";
import { formatPrice } from "../../utils/marketSummary";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  activeAssetCount: number;
  activeDatasetCount: number;
  firmsSnapshot?: FirmsSnapshot | null;
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
}

export function StatusBar({
  activeAssetCount,
  activeDatasetCount,
  firmsSnapshot = null,
  hasError,
  lastUpdate,
  latestActivity = null,
  marketSummary
}: StatusBarProps) {
  const marketLabel = marketSummary
    ? `MARKET: BRENT ${formatPrice(marketSummary.brent.value)} | ${formatClassificationLabel(marketSummary.classification)} | ${formatCadenceLabel(marketSummary.cadence)}`
    : "MARKET: NO OPEN DATA";
  const firmsLabel = firmsSnapshot
    ? `FIRMS: ${formatClassificationLabel(firmsSnapshot.classification)} | ${formatCadenceLabel(firmsSnapshot.cadence)} | ${firmsSnapshot.asOf.slice(0, 16).replace("T", " ")}`
    : "FIRMS: NO OPEN DATA";
  const workspaceLabel = hasError ? "WORKSPACE: PARTIAL" : "WORKSPACE: READY";

  return (
    <div className={styles.statusBar}>
      <div className={styles.item}>REGION: MIDDLE EAST</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>{workspaceLabel}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>{marketLabel}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>{firmsLabel}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>MAP: QUARTERLY | {lastUpdate}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>DATASETS: {activeDatasetCount}</div>
      <span className={styles.separator}>·</span>
      <div className={styles.item}>VISIBLE ASSETS: {activeAssetCount}</div>
      {latestActivity ? (
        <>
          <span className={styles.separator}>·</span>
          <div className={`${styles.item} ${styles.activityTrace}`}>
            LAST: {latestActivity.timestamp} {latestActivity.label}
          </div>
        </>
      ) : null}
    </div>
  );
}
