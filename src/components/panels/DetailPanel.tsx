import { Panel } from "../common/Panel";
import styles from "./DetailPanel.module.css";
import { formatCapacity } from "../../utils/formatters";
import type { RefineryProperties, SourceMetadata } from "../../types/Refinery";

interface DetailPanelProps {
  metadata: SourceMetadata | null;
  refinery: RefineryProperties | null;
}

export function DetailPanel({ metadata, refinery }: DetailPanelProps) {
  return (
    <Panel title="DETAIL CARD">
      {refinery ? (
        <div className={styles.card}>
          <div className={styles.name}>{refinery.name}</div>
          <div className={styles.row}>
            <span className={styles.label}>Owner</span>
            <span className={styles.value}>{refinery.owner}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Operator</span>
            <span className={styles.value}>{refinery.operator}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Status</span>
            <span className={styles.value}>{refinery.status.replaceAll("_", " ")}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Capacity</span>
            <span className={styles.value}>{refinery.capacity_bpd ? formatCapacity(refinery.capacity_bpd) : "--"}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Country</span>
            <span className={styles.value}>{refinery.countryName}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Ticker</span>
            <span className={styles.value}>{refinery.ticker ?? "--"}</span>
          </div>
          <div className={styles.metaBlock}>
            <div className={styles.metaLine}>Source: {metadata?.source ?? "--"}</div>
            <div className={styles.metaLine}>Updated: {metadata?.downloadDate ?? "--"}</div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          SELECT AN ASSET TO OPEN ITS TERMINAL DETAIL CARD.
        </div>
      )}
    </Panel>
  );
}
