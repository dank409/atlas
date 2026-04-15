import { Panel } from "../common/Panel";
import styles from "./LayerControlsPanel.module.css";
import type { RefineryStatus } from "../../types/Refinery";

interface LayerControlsPanelProps {
  countryFilter: string;
  countryOptions: Array<{
    label: string;
    value: string;
  }>;
  isRefineriesVisible: boolean;
  onCountryFilterChange: (value: string) => void;
  onStatusFilterChange: (value: RefineryStatus | "ALL") => void;
  onToggleRefineries: () => void;
  refineryTotalCount: number;
  refineryVisibleCount: number;
  statusFilter: RefineryStatus | "ALL";
  statusOptions: Array<{
    label: string;
    value: RefineryStatus;
  }>;
}

export function LayerControlsPanel({
  countryFilter,
  countryOptions,
  isRefineriesVisible,
  onCountryFilterChange,
  onStatusFilterChange,
  onToggleRefineries,
  refineryTotalCount,
  refineryVisibleCount,
  statusFilter,
  statusOptions
}: LayerControlsPanelProps) {
  return (
    <Panel
      badge={`${refineryVisibleCount}/${refineryTotalCount} assets`}
      title="LAYER CONTROLS"
    >
      <button
        aria-label="Toggle refineries layer"
        className={styles.layerButton}
        onClick={onToggleRefineries}
        type="button"
      >
        <span className={styles.layerTitle}>REFINERIES</span>
        <span className={isRefineriesVisible ? styles.activeState : styles.inactiveState}>
          {isRefineriesVisible ? "VISIBLE" : "HIDDEN"}
        </span>
      </button>
      <div className={styles.filterGroup}>
        <label
          className={styles.filterLabel}
          htmlFor="country-filter"
        >
          Country filter
        </label>
        <select
          className={styles.filterSelect}
          id="country-filter"
          onChange={(event) => onCountryFilterChange(event.target.value)}
          value={countryFilter}
        >
          <option value="ALL">ALL COUNTRIES</option>
          {countryOptions.map((country) => (
            <option
              key={country.value}
              value={country.value}
            >
              {country.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.filterGroup}>
        <label
          className={styles.filterLabel}
          htmlFor="status-filter"
        >
          Status filter
        </label>
        <select
          className={styles.filterSelect}
          id="status-filter"
          onChange={(event) => onStatusFilterChange(event.target.value as RefineryStatus | "ALL")}
          value={statusFilter}
        >
          <option value="ALL">ALL STATUSES</option>
          {statusOptions.map((status) => (
            <option
              key={status.value}
              value={status.value}
            >
              {status.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.helperText}>
        P0 SLICE: COUNTRY AND STATUS FILTERS NOW DRIVE THE SAME REFINERY SET ACROSS TABLE, SEARCH, DETAIL, AND MAP.
      </div>
    </Panel>
  );
}
