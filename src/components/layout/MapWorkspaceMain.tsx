import { Panel } from "../common/Panel";
import { AssetGridTable } from "../tables/AssetGridTable";
import { MapView, type BasemapMode } from "../map/MapView";
import type { AssetGridRow, DatasetId, InfrastructureAsset } from "../../types/Infrastructure";
import type { OutageEvent } from "../../types/outageEvent";
import type { FirmsSnapshot } from "../../types/firms";
import type { ScenarioVisualState } from "../../utils/scenarioMapStyles";
import type { MapDisplaySettings } from "../../types/mapDisplaySettings";
import type { BypassModelResult } from "../../utils/bypassModel";
import styles from "./MapWorkspaceMain.module.css";

// MapView is imported statically here. App.tsx code-splits this whole
// module (MapWorkspaceMain + MapView + mapbox-gl + every downstream
// import) behind a single `React.lazy` + `<Suspense>` boundary, so
// keeping the inner import tree flat means the whole map surface
// lands in one async chunk instead of a second redundant split.

interface MapWorkspaceMainProps {
  activeDatasetIds: DatasetId[];
  gridDatasetId: DatasetId | null;
  gridRows: AssetGridRow[];
  hasError: boolean;
  basemapMode: BasemapMode;
  /**
   * When false the asset grid collapses to a single header row, giving
   * the map the entire viewport. Undefined defaults to open.
   */
  isAssetGridOpen?: boolean;
  onToggleAssetGrid?: () => void;
  latestUpdate: string;
  onClearSelection: () => void;
  /**
   * Grid row click → inspect overlay. Optional: when omitted the
   * table falls back to routing row clicks through `onSelectAsset`
   * (legacy behaviour the integration tests still rely on).
   */
  onInspectAsset?: (asset: InfrastructureAsset) => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  onSelectBasemap: (mode: BasemapMode) => void;
  outageEvents?: OutageEvent[] | null;
  firmsSnapshot?: FirmsSnapshot | null;
  scenarioState: ScenarioVisualState;
  selectedAssetId: string | null;
  visibleAssets: InfrastructureAsset[];
  mapDisplaySettings?: MapDisplaySettings;
  regionalSnapshot?: {
    bypassResult: BypassModelResult | null;
    disruptionPct: number;
    hormuzBaselineMbpd: number;
    firmsAlertCount: number;
  };
}

export function MapWorkspaceMain({
  activeDatasetIds,
  gridDatasetId,
  gridRows,
  hasError,
  basemapMode,
  isAssetGridOpen = true,
  onToggleAssetGrid,
  latestUpdate,
  onClearSelection,
  onInspectAsset,
  onSelectAsset,
  onSelectBasemap,
  outageEvents = null,
  firmsSnapshot = null,
  scenarioState,
  selectedAssetId,
  visibleAssets,
  mapDisplaySettings,
  regionalSnapshot
}: MapWorkspaceMainProps) {
  const workspaceClassName = [
    styles.workspace,
    !isAssetGridOpen ? styles.workspaceGridCollapsed : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={workspaceClassName}>
      <div className={styles.mapRegion}>
        <MapView
          activeDatasetIds={activeDatasetIds}
          hasError={hasError}
          basemapMode={basemapMode}
          onClearSelection={onClearSelection}
          onSelectAsset={onSelectAsset}
          onSelectBasemap={onSelectBasemap}
          outageEvents={outageEvents}
          firmsSnapshot={firmsSnapshot}
          scenarioState={scenarioState}
          selectedAssetId={selectedAssetId}
          visibleAssets={visibleAssets}
          mapDisplaySettings={mapDisplaySettings}
          regionalSnapshot={regionalSnapshot}
        />
      </div>
      <Panel
        title="ASSET GRID"
        badge={`${gridRows.length} VISIBLE`}
        trailing={
          onToggleAssetGrid ? (
            <button
              aria-label={isAssetGridOpen ? "Collapse asset grid" : "Expand asset grid"}
              className={styles.gridToggle}
              onClick={onToggleAssetGrid}
              title={isAssetGridOpen ? "Collapse grid — \\" : "Expand grid — \\"}
              type="button"
            >
              {isAssetGridOpen ? "▼" : "▲"}
            </button>
          ) : undefined
        }
      >
        {isAssetGridOpen ? (
          <AssetGridTable
            activeDatasetCount={activeDatasetIds.length}
            gridDatasetId={gridDatasetId}
            latestUpdate={latestUpdate}
            onInspectAsset={onInspectAsset}
            onSelectAsset={onSelectAsset}
            rows={gridRows}
            selectedAssetId={selectedAssetId}
          />
        ) : null}
      </Panel>
    </section>
  );
}
