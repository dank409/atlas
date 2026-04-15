import { Panel } from "../common/Panel";
import type { DatasetCatalogEntry, DatasetId } from "../../types/Infrastructure";
import styles from "./DatasetCatalogPanel.module.css";

interface DatasetCatalogPanelProps {
  activeDatasetIds: DatasetId[];
  catalog: DatasetCatalogEntry[];
  focusedDatasetId: DatasetId;
  onFocusDataset: (datasetId: DatasetId) => void;
  onToggleDataset: (datasetId: DatasetId) => void;
}

export function DatasetCatalogPanel({
  activeDatasetIds,
  catalog,
  focusedDatasetId,
  onFocusDataset,
  onToggleDataset
}: DatasetCatalogPanelProps) {
  return (
    <Panel
      title="DATASET CATALOG"
      badge={`${activeDatasetIds.length} ACTIVE`}
    >
      <div className={styles.catalogList}>
        {catalog.map((entry) => {
          const isActive = activeDatasetIds.includes(entry.id);
          const isFocused = focusedDatasetId === entry.id;
          const isAvailable = entry.status === "available";

          return (
            <article
              className={isFocused ? styles.catalogCardFocused : styles.catalogCard}
              key={entry.id}
            >
              <div className={styles.cardHeader}>
                <button
                  className={isFocused ? styles.datasetButtonFocused : styles.datasetButton}
                  disabled={!isAvailable}
                  onClick={() => onFocusDataset(entry.id)}
                  type="button"
                >
                  <span>{entry.title}</span>
                  <span className={styles.recordCount}>{entry.recordCount}</span>
                </button>
                <button
                  className={isActive ? styles.toggleButtonActive : styles.toggleButton}
                  disabled={!isAvailable}
                  onClick={() => onToggleDataset(entry.id)}
                  type="button"
                >
                  {isActive ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.metaRow}>
                <span>{entry.source}</span>
                <span className={styles.separator}>|</span>
                <span>{entry.frequency}</span>
                <span className={styles.separator}>|</span>
                <span>{entry.coverage}</span>
              </div>
              <div className={styles.note}>{entry.notes}</div>
              <div className={styles.statusRow}>
                <span className={isAvailable ? styles.statusAvailable : styles.statusCurating}>
                  {entry.status.toUpperCase()}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
