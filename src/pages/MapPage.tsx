import { Suspense, lazy } from "react";
import { MapLoadingFallback } from "../components/layout/MapLoadingFallback";
import { BASEMAP_MODE_LABELS, type BasemapMode } from "../components/map/MapView";
import type { AssetGridRow, DatasetId, InfrastructureAsset } from "../types/Infrastructure";
import type { OutageEvent } from "../types/outageEvent";
import type { FirmsSnapshot } from "../types/firms";
import type { ScenarioVisualState } from "../utils/scenarioMapStyles";
import type { MapDisplaySettings } from "../types/mapDisplaySettings";
import type { BypassModelResult } from "../utils/bypassModel";

// MapWorkspaceMain is lazy-imported here so that non-MAP views (and
// the MAP view on first mount) don't pay the mapbox-gl bundle cost
// before they need to. Previously this import lived in App.tsx — it
// moves here so App.tsx no longer cares about the map engine at all.
const MapWorkspaceMain = lazy(() =>
  import("../components/layout/MapWorkspaceMain").then((module) => ({
    default: module.MapWorkspaceMain
  }))
);

interface MapPageProps {
  activeDatasetIds: DatasetId[];
  gridDatasetId: DatasetId | null;
  gridRows: AssetGridRow[];
  hasError: boolean;
  basemapMode: BasemapMode;
  isAssetGridOpen: boolean;
  onToggleAssetGrid: () => void;
  latestUpdate: string;
  onClearSelection: () => void;
  onInspectAsset: (asset: InfrastructureAsset) => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  onSelectBasemap: (mode: BasemapMode) => void;
  appendActivity: (label: string) => void;
  outageEvents: OutageEvent[] | null;
  firmsSnapshot: FirmsSnapshot | null;
  scenarioState: ScenarioVisualState;
  selectedAssetId: string | null;
  visibleAssets: InfrastructureAsset[];
  mapDisplaySettings: MapDisplaySettings;
  regionalSnapshot: {
    bypassResult: BypassModelResult | null;
    disruptionPct: number;
    hormuzBaselineMbpd: number;
    firmsAlertCount: number;
  };
}

/**
 * MAP view page. Thin wrapper around the existing MapWorkspaceMain —
 * all the real heavy lifting (Mapbox rendering, hover card, asset
 * grid, regional snapshot overlay) is already in that component.
 * This page exists so App.tsx's view router can dispatch on ViewMode
 * without caring about map internals.
 */
export function MapPage({
  activeDatasetIds,
  gridDatasetId,
  gridRows,
  hasError,
  basemapMode,
  isAssetGridOpen,
  onToggleAssetGrid,
  latestUpdate,
  onClearSelection,
  onInspectAsset,
  onSelectAsset,
  onSelectBasemap,
  appendActivity,
  outageEvents,
  firmsSnapshot,
  scenarioState,
  selectedAssetId,
  visibleAssets,
  mapDisplaySettings,
  regionalSnapshot
}: MapPageProps) {
  return (
    <Suspense fallback={<MapLoadingFallback />}>
      <MapWorkspaceMain
        activeDatasetIds={activeDatasetIds}
        basemapMode={basemapMode}
        firmsSnapshot={firmsSnapshot}
        gridDatasetId={gridDatasetId}
        gridRows={gridRows}
        hasError={hasError}
        isAssetGridOpen={isAssetGridOpen}
        latestUpdate={latestUpdate}
        mapDisplaySettings={mapDisplaySettings}
        onClearSelection={onClearSelection}
        onInspectAsset={onInspectAsset}
        onSelectAsset={onSelectAsset}
        onSelectBasemap={(mode) => {
          onSelectBasemap(mode);
          appendActivity(`BASEMAP ${BASEMAP_MODE_LABELS[mode]}`);
        }}
        onToggleAssetGrid={onToggleAssetGrid}
        outageEvents={outageEvents}
        regionalSnapshot={regionalSnapshot}
        scenarioState={scenarioState}
        selectedAssetId={selectedAssetId}
        visibleAssets={visibleAssets}
      />
    </Suspense>
  );
}
