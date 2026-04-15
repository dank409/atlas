import type { InfrastructureAsset } from "../../types/Infrastructure";
import { getAssetTypeLabel } from "../../utils/infrastructure";
import styles from "./ClearSelectionBar.module.css";

interface ClearSelectionBarProps {
  asset: InfrastructureAsset;
  onClear: () => void;
}

/**
 * Sticky header bar that anchors the right sidebar when an asset is locked.
 * Provides the unmissable "× CLEAR SELECTION" exit affordance the contextual
 * sidebar relies on — without it the user has no way to revert from State B
 * back to the legend/filters view (State A) other than clicking empty map.
 */
export function ClearSelectionBar({ asset, onClear }: ClearSelectionBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.summary}>
        <span className={styles.kind}>{getAssetTypeLabel(asset)}</span>
        <span className={styles.name}>{asset.name}</span>
      </div>
      <button
        aria-label="Clear selection"
        className={styles.clearButton}
        onClick={onClear}
        type="button"
      >
        <span className={styles.clearGlyph}>×</span>
        CLEAR SELECTION
      </button>
    </div>
  );
}
