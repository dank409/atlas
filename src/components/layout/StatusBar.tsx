import { MAP_DATA_SOURCES } from "../../constants/datasetCatalog";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  hasError: boolean;
  isLoading: boolean;
  totalAssetCount: number;
  visibleAssetCount: number;
}

export function StatusBar({ hasError, isLoading, totalAssetCount, visibleAssetCount }: StatusBarProps) {
  const loadState = hasError ? "DATA LOAD FAILED" : isLoading ? "LOADING DATA" : null;

  return (
    <div className={styles.statusBar}>
      <span className={styles.item}>MIDDLE EAST OIL &amp; GAS INFRASTRUCTURE</span>
      <span className={styles.separator}>|</span>
      {loadState ? (
        <>
          <span className={hasError ? styles.itemError : styles.item}>{loadState}</span>
          <span className={styles.separator}>|</span>
        </>
      ) : null}
      <span className={styles.item}>
        SHOWING {visibleAssetCount} OF {totalAssetCount} ASSETS
      </span>
      <span className={styles.itemRight}>DATA: {MAP_DATA_SOURCES}</span>
    </div>
  );
}
