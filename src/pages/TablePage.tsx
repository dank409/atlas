import { useMemo, useState } from "react";
import { AssetTable } from "../components/tables/AssetTable";
import type { DatasetCatalogEntry, DatasetId, InfrastructureAsset } from "../types/Infrastructure";
import { matchesQuery } from "../utils/infrastructure";
import styles from "./TablePage.module.css";

interface TablePageProps {
  /** Layers that are switched on, in catalog order. One tab each. */
  activeDatasets: DatasetCatalogEntry[];
  /** The layer whose rows are shown; null when every layer is off. */
  focusedDataset: DatasetCatalogEntry | null;
  onFocusDataset: (datasetId: DatasetId) => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  selectedAssetId: string | null;
  /** The same assets the map is showing. */
  visibleAssets: InfrastructureAsset[];
}

/**
 * TABLE view: the assets the map shows, as sortable rows. It shares the
 * left rail's layer and energy toggles with the map, and adds a text
 * filter of its own.
 */
export function TablePage({
  activeDatasets,
  focusedDataset,
  onFocusDataset,
  onSelectAsset,
  selectedAssetId,
  visibleAssets
}: TablePageProps) {
  const [rowFilter, setRowFilter] = useState("");
  const layerAssets = useMemo(
    () => (focusedDataset ? visibleAssets.filter((asset) => asset.datasetId === focusedDataset.id) : []),
    [focusedDataset, visibleAssets]
  );
  const rows = useMemo(
    () => layerAssets.filter((asset) => matchesQuery(asset, rowFilter)),
    [layerAssets, rowFilter]
  );

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <div aria-label="Layer" className={styles.tabs} role="tablist">
          {activeDatasets.map((dataset) => (
            <button
              aria-selected={dataset.id === focusedDataset?.id}
              className={dataset.id === focusedDataset?.id ? styles.tabActive : styles.tab}
              key={dataset.id}
              onClick={() => onFocusDataset(dataset.id)}
              role="tab"
              type="button"
            >
              {dataset.title}
            </button>
          ))}
        </div>
        <input
          aria-label="Filter rows"
          className={styles.filterInput}
          onChange={(event) => setRowFilter(event.target.value)}
          placeholder="FILTER ROWS BY NAME, COUNTRY, OPERATOR"
          type="search"
          value={rowFilter}
        />
      </header>

      {focusedDataset ? (
        <>
          <div className={styles.meta}>
            <span>
              {rows.length === layerAssets.length ? `${rows.length} ROWS` : `${rows.length} OF ${layerAssets.length} ROWS`}
            </span>
            <span className={styles.separator}>|</span>
            <span>
              SOURCE: {focusedDataset.source} · {focusedDataset.downloadDate}
            </span>
          </div>
          <div className={styles.tableRegion}>
            {rows.length > 0 ? (
              <AssetTable
                assets={rows}
                datasetId={focusedDataset.id}
                // Remount per layer so sort order resets with the column set.
                key={focusedDataset.id}
                onSelectAsset={onSelectAsset}
                selectedAssetId={selectedAssetId}
              />
            ) : (
              <div className={styles.emptyState}>NO ROWS MATCH. CHECK THE FILTERS ON THE LEFT AND THE ROW FILTER ABOVE.</div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>NO LAYERS ARE SWITCHED ON. TURN ONE ON IN THE LEFT RAIL.</div>
      )}
    </section>
  );
}
