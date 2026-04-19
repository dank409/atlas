import type { DatasetId } from "../../types/Infrastructure";
import styles from "./LeftRail.module.css";

interface LeftRailProps {
  activeDatasetIds: DatasetId[];
  datasetCounts: Record<DatasetId, number>;
  activeRegion: RegionCode;
  onSelectRegion: (region: RegionCode) => void;
  onToggleDataset: (datasetId: DatasetId) => void;
  watchlist: WatchlistItem[];
}

export type RegionCode = "MENA" | "AG" | "RED_SEA" | "LEVANT";

export interface WatchlistItem {
  id: string;
  label: string;
  status: "nominal" | "elevated" | "alert" | "offline";
  note: string;
}

interface GroupConfig {
  title: string;
  items: LayerItem[];
}

interface LayerItem {
  datasetId: DatasetId;
  label: string;
  glyph?: string;
  color: string;
  dash?: boolean;
}

// Visual grouping from the design brief. Each row maps to a dataset
// ID in the workspace reducer — toggling the checkbox dispatches the
// existing `onToggleDataset` so the layer state stays authoritative
// in a single place.
const LAYER_GROUPS: GroupConfig[] = [
  {
    title: "PIPELINES",
    items: [
      { datasetId: "pipelines", label: "Crude & product", color: "#FF5722" }
    ]
  },
  {
    title: "UPSTREAM",
    items: [
      { datasetId: "fields", label: "Oil & gas fields", glyph: "●", color: "#FF8C00" }
    ]
  },
  {
    title: "DOWNSTREAM",
    items: [
      { datasetId: "refineries", label: "Refineries", glyph: "◆", color: "#FFCC80" },
      { datasetId: "terminals", label: "Export terminals", glyph: "▲", color: "#E0E0E0" }
    ]
  },
  {
    title: "GEOPOLITICAL",
    items: [
      { datasetId: "chokepoints", label: "Chokepoints", glyph: "⊙", color: "#FFD600" }
    ]
  }
];

const REGION_CHIPS: { id: RegionCode; label: string }[] = [
  { id: "MENA", label: "MENA" },
  { id: "AG", label: "AG" },
  { id: "RED_SEA", label: "RED SEA" },
  { id: "LEVANT", label: "LEVANT" }
];

/**
 * Fixed left-rail shell used across every view. Groups:
 *
 *   LAYERS · FILTERS   header
 *   REGION             chip row
 *   PIPELINES          grouped layer toggles
 *   UPSTREAM
 *   DOWNSTREAM
 *   GEOPOLITICAL
 *   WATCHLIST          live-populated from outage events + FIRMS
 *                      anomalies; read-only, surfaces what's hot.
 */
export function LeftRail({
  activeDatasetIds,
  datasetCounts,
  activeRegion,
  onSelectRegion,
  onToggleDataset,
  watchlist
}: LeftRailProps) {
  return (
    <div className={styles.rail}>
      <header className={styles.railHeader}>
        <span className={styles.railHeaderLabel}>
          <span className={styles.railHeaderDot} />
          LAYERS · FILTERS
        </span>
        <span className={styles.railHeaderTag}>L1</span>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>REGION</div>
        <div className={styles.chipRow}>
          {REGION_CHIPS.map((chip) => (
            <button
              className={chip.id === activeRegion ? styles.chipActive : styles.chip}
              key={chip.id}
              onClick={() => onSelectRegion(chip.id)}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {LAYER_GROUPS.map((group) => (
        <section className={styles.section} key={group.title}>
          <div className={styles.sectionLabel}>{group.title}</div>
          {group.items.map((item) => {
            const isActive = activeDatasetIds.includes(item.datasetId);
            const count = datasetCounts[item.datasetId] ?? 0;
            return (
              <label className={styles.layerRow} key={item.datasetId}>
                <span
                  aria-hidden="true"
                  className={isActive ? styles.checkboxActive : styles.checkbox}
                >
                  {isActive ? "✓" : ""}
                </span>
                <input
                  checked={isActive}
                  className={styles.hiddenInput}
                  onChange={() => onToggleDataset(item.datasetId)}
                  type="checkbox"
                />
                {item.glyph ? (
                  <span className={styles.glyph} style={{ color: item.color }}>
                    {item.glyph}
                  </span>
                ) : (
                  <span
                    className={styles.lineSwatch}
                    style={{ background: item.color }}
                  />
                )}
                <span className={isActive ? styles.labelActive : styles.labelInactive}>
                  {item.label}
                </span>
                <span className={styles.count}>{count}</span>
              </label>
            );
          })}
        </section>
      ))}

      <section className={styles.section}>
        <div className={styles.sectionLabel}>WATCHLIST</div>
        {watchlist.length === 0 ? (
          <div className={styles.emptyWatchlist}>NO ITEMS</div>
        ) : (
          watchlist.map((item) => (
            <div className={styles.watchlistRow} key={item.id}>
              <span className={`${styles.watchDot} ${statusClass(item.status, styles)}`} />
              <span className={styles.watchLabel}>{item.label}</span>
              <span className={styles.watchNote}>{item.note}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function statusClass(
  status: WatchlistItem["status"],
  stylesMap: Record<string, string>
): string {
  if (status === "alert") return stylesMap.watchAlert;
  if (status === "elevated") return stylesMap.watchElevated;
  if (status === "offline") return stylesMap.watchOffline;
  return stylesMap.watchNominal;
}
