import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { TopNav } from "./components/layout/TopNav";
import { LeftRail, type RegionCode, type WatchlistItem } from "./components/layout/LeftRail";
import { StatusBar } from "./components/layout/StatusBar";
import { TimelineScrubber } from "./components/layout/TimelineScrubber";
import { MapContentPanel } from "./components/panels/MapContentPanel";
import { MapDisplayControls } from "./components/panels/MapDisplayControls";
import { MarketModulesStack } from "./components/market/MarketModulesStack";
import { ContextPanelStack } from "./components/panels/ContextPanelStack";
import { ClearSelectionBar } from "./components/panels/ClearSelectionBar";
import { AssetDetailOverlay } from "./components/tables/AssetDetailOverlay";
import { GradeDetailOverlay } from "./components/tables/GradeDetailOverlay";
import { CompanyDetailOverlay } from "./components/panels/CompanyDetailOverlay";
import { CountryDetailOverlay } from "./components/panels/CountryDetailOverlay";
import { MapPage } from "./pages/MapPage";
import { MarketsPage } from "./pages/MarketsPage";
import { EventsPage } from "./pages/EventsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ChokesPage } from "./pages/ChokesPage";
import { FlowsPage } from "./pages/FlowsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AisPage } from "./pages/AisPage";
import { NotesPage } from "./pages/NotesPage";
import { AboutPage } from "./pages/AboutPage";
import { DataPage } from "./pages/DataPage";
import { ReferencePage } from "./pages/ReferencePage";
import type { CrudeGrade } from "./types/CrudeGrade";
import { useMapWorkspaceData } from "./hooks/useMapWorkspaceData";
import type { ViewMode } from "./types/View";
import { AppShellLayout } from "./components/layout/AppShellLayout";
import { type BasemapMode } from "./components/map/MapView";
import { MarketTape } from "./components/market/MarketTape";
import { useCrudePrices } from "./hooks/useCrudePrices";
import { useIceSettlements } from "./hooks/useIceSettlements";
import { useBypassModel } from "./hooks/useBypassModel";
import { DEFAULT_BYPASS_CONSTANTS } from "./utils/bypassModel";
import { useOutageEvents } from "./hooks/useOutageEvents";
import { useBrentHistorical } from "./hooks/useBrentHistorical";
import { useFirms } from "./hooks/useFirms";
import type { TerminalActivityEntry } from "./types/Activity";
import type { FirmsWindowHours } from "./types/firms";
import { DEFAULT_MAP_DISPLAY_SETTINGS, type MapDisplaySettings } from "./types/mapDisplaySettings";
import type {
  ChokepointAsset,
  CompanyProfile,
  CountryProfile,
  DatasetFiltersById,
  DatasetId,
  InfrastructureAsset,
  MapWorkspaceState,
  RefineryAsset
} from "./types/Infrastructure";
import {
  DEFAULT_DATASET_FILTERS,
  buildAssetGridRows,
  buildSearchResults,
  filterAssets,
  getAssetTypeLabel
} from "./utils/infrastructure";
import { resolveTerminalCommand } from "./utils/commandBar";
import { filterAssetsByRegion, formatRegionLabel } from "./utils/regionFilter";
import styles from "./App.module.css";

// `LeftSidebarTab`/`LEFT_SIDEBAR_TABS` removed in the shell rewrite —
// the left rail is now a single unified grouped-layers + region + watchlist
// surface (see `LeftRail`). The bypass model controls migrated into the
// MODELS view page (`ModelsPage`).

interface WorkspaceAction {
  activeDatasetIds?: DatasetId[];
  datasetId?: DatasetId;
  field?: string;
  fallbackFocusedDatasetId?: DatasetId;
  focusedDatasetId?: DatasetId;
  query?: string;
  selectedAssetId?: string | null;
  type:
    | "focusDataset"
    | "hydrateCatalog"
    | "selectAsset"
    | "setDatasetFilter"
    | "setSearchQuery"
    | "toggleDataset";
  validDatasetIds?: DatasetId[];
}

// Tagged union for the detail-overlay navigation stack. The
// overlay renderer at the bottom of <AppShellLayout> switches on
// `kind` to pick which overlay component to mount.
type OverlayEntry =
  | { kind: "asset"; asset: InfrastructureAsset }
  | { kind: "grade"; grade: CrudeGrade }
  | { kind: "company"; company: CompanyProfile }
  | { kind: "country"; country: CountryProfile };

const INITIAL_WORKSPACE_STATE: MapWorkspaceState = {
  activeDatasetIds: [],
  filtersByDataset: DEFAULT_DATASET_FILTERS,
  focusedDatasetId: "refineries",
  searchQuery: "",
  selectedAssetId: null
};

export function App() {
  const {
    assets,
    catalog,
    companiesById,
    countriesByCode,
    exposureByTargetId = {},
    firmsBaselineByAssetId,
    error
  } = useMapWorkspaceData();
  const crudePrices = useCrudePrices();
  const iceSettlements = useIceSettlements();
  const bypassModel = useBypassModel();
  const outageEvents = useOutageEvents();
  const brentHistorical = useBrentHistorical();
  const [activeView, setActiveView] = useState<ViewMode>("map");
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("dark");
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isAssetGridOpen, setIsAssetGridOpen] = useState(true);
  // Detail-overlay navigation stack. Each entry is the overlay that
  // is (or was) on screen — the tail is the one currently shown,
  // earlier entries are the back-navigation history.
  //
  //   external open  → reset the stack to a single entry
  //   internal drill → push onto the stack (e.g. asset → country)
  //   back button    → pop one entry
  //   close button   → clear the stack
  //
  // Using a single stack instead of four independent slots makes
  // the back button trivially correct (it's just "pop"), enforces
  // the "only one overlay at a time" invariant automatically, and
  // collapses four sets of handlers into two (open/drill).
  const [overlayStack, setOverlayStack] = useState<OverlayEntry[]>([]);
  const currentOverlay: OverlayEntry | null =
    overlayStack.length > 0 ? overlayStack[overlayStack.length - 1] : null;
  const canGoBackOverlay = overlayStack.length > 1;
  const [activityLog, setActivityLog] = useState<TerminalActivityEntry[]>([]);
  // Region-chip selection in the left rail. Persisted only in React
  // state for now — the reducer already owns per-dataset filters.
  const [activeRegion, setActiveRegion] = useState<RegionCode>("MENA");
  // Clocks are hoisted here so every view gets the same time. Updated
  // once per second — see the ticking effect below.
  const [nowStamp, setNowStamp] = useState<Date>(() => new Date());
  // Timeline playhead [0, 1]. 1 = NOW, < 1 = rewound. When rewound,
  // the EVENTS feed filters to events before the playhead and the MAP
  // view overlays a subtle TIME MACHINE banner. Map geometry itself
  // does not rewind (no historical asset-state dataset yet) — the
  // banner is explicit about what time-travel does and doesn't affect.
  const [timeT, setTimeT] = useState<number>(1);
  // FIRMS runtime controls. Defaults match CLAUDE.md FIRMS notes: 72h
  // window, confidence >= 80, layer enabled on mount. The window/
  // confidence setters migrated out of App.tsx with the dashboard;
  // they'll return if a dedicated FIRMS settings panel lands.
  const [firmsWindowHours] = useState<FirmsWindowHours>(72);
  const [firmsConfidenceThreshold] = useState<number>(80);
  const [isFirmsLayerEnabled] = useState<boolean>(true);
  const [mapDisplaySettings, setMapDisplaySettings] = useState<MapDisplaySettings>(DEFAULT_MAP_DISPLAY_SETTINGS);
  const firms = useFirms({
    assets,
    baselineByAssetId: firmsBaselineByAssetId,
    windowHours: firmsWindowHours,
    confidenceThreshold: firmsConfidenceThreshold,
    enabled: isFirmsLayerEnabled
  });
  const [workspaceState, dispatch] = useReducer(workspaceReducer, INITIAL_WORKSPACE_STATE);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const availableDatasetIds = useMemo(
    () => catalog.filter((entry) => entry.status === "available").map((entry) => entry.id),
    [catalog]
  );
  const defaultActiveDatasetIds = useMemo(
    () => catalog.filter((entry) => entry.status === "available" && entry.defaultActive).map((entry) => entry.id),
    [catalog]
  );
  const focusedDataset = useMemo(
    () => catalog.find((entry) => entry.id === workspaceState.focusedDatasetId) ?? null,
    [catalog, workspaceState.focusedDatasetId]
  );
  // Dataset-level filter first (catalog + per-dataset filters), then
  // the LeftRail region chip narrows by country code. Keeping the
  // two steps separate means dataset toggles don't have to know
  // about region state and vice versa.
  const visibleAssetsBeforeRegion = useMemo(
    () => filterAssets(assets, workspaceState.activeDatasetIds, workspaceState.filtersByDataset),
    [assets, workspaceState.activeDatasetIds, workspaceState.filtersByDataset]
  );
  const visibleAssets = useMemo(
    () => filterAssetsByRegion(visibleAssetsBeforeRegion, activeRegion),
    [visibleAssetsBeforeRegion, activeRegion]
  );
  const gridDatasetId = useMemo(() => {
    if (workspaceState.activeDatasetIds.includes(workspaceState.focusedDatasetId)) {
      return workspaceState.focusedDatasetId;
    }

    return workspaceState.activeDatasetIds[0] ?? null;
  }, [workspaceState.activeDatasetIds, workspaceState.focusedDatasetId]);
  const gridAssets = useMemo(
    () => (gridDatasetId ? visibleAssets.filter((asset) => asset.datasetId === gridDatasetId) : visibleAssets),
    [gridDatasetId, visibleAssets]
  );
  const gridRows = useMemo(() => buildAssetGridRows(gridAssets, catalog), [gridAssets, catalog]);
  const searchResults = useMemo(
    () => buildSearchResults(assets, workspaceState.searchQuery).slice(0, 6),
    [assets, workspaceState.searchQuery]
  );
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === workspaceState.selectedAssetId) ?? null,
    [assets, workspaceState.selectedAssetId]
  );
  const lastUpdate = useMemo(() => {
    const dates = visibleAssets.map((asset) => asset._metadata.downloadDate).filter(Boolean);

    return dates.length > 0 ? dates.sort().at(-1) ?? "--" : "--";
  }, [visibleAssets]);

  // Scenario visual state that the map consumes. Built from the bypass
  // model's resolved utilisation fractions (not the raw override sliders) so
  // the map lights up based on the *actual physical bypass flow* after
  // merit-order allocation, never on raw user input.
  const scenarioVisualState = useMemo(
    () => ({
      disruptionPct: bypassModel.disruptionPercentage,
      saudiUtilisationPct: bypassModel.result.saudiUtilisationPct,
      uaeUtilisationPct: bypassModel.result.uaeUtilisationPct,
      isScenarioActive: bypassModel.isScenarioActive
    }),
    [
      bypassModel.disruptionPercentage,
      bypassModel.isScenarioActive,
      bypassModel.result.saudiUtilisationPct,
      bypassModel.result.uaeUtilisationPct
    ]
  );

  useEffect(() => {
    if (!catalog.length) {
      return;
    }

    dispatch({
      type: "hydrateCatalog",
      activeDatasetIds: defaultActiveDatasetIds,
      focusedDatasetId: defaultActiveDatasetIds[0] ?? availableDatasetIds[0] ?? "refineries",
      validDatasetIds: availableDatasetIds
    });
  }, [availableDatasetIds, catalog.length, defaultActiveDatasetIds]);

  useEffect(() => {
    if (
      workspaceState.selectedAssetId &&
      !visibleAssets.some((asset) => asset.id === workspaceState.selectedAssetId)
    ) {
      dispatch({
        type: "selectAsset",
        selectedAssetId: null
      });
    }
  }, [visibleAssets, workspaceState.selectedAssetId]);

  const appendActivity = useCallback((label: string) => {
    const timestamp = new Intl.DateTimeFormat("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());

    setActivityLog((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        label,
        timestamp
      },
      ...current
    ].slice(0, 14));
  }, []);

  // One-shot: when the outage snapshot first loads, seed the activity
  // log with the three most-recent events so the log has energy-event
  // signal from the start, not just UI state changes. Gated on a ref so
  // a late re-fetch doesn't re-seed.
  const outageSeededRef = useRef(false);
  useEffect(() => {
    if (outageSeededRef.current || !outageEvents.snapshot) {
      return;
    }
    outageSeededRef.current = true;
    const recent = [...outageEvents.snapshot.events]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 3);
    for (const event of recent.reverse()) {
      appendActivity(`OUTAGE: ${event.name.toUpperCase()} (${event.severity})`);
    }
  }, [outageEvents.snapshot, appendActivity]);

  const handleChangeView = useCallback(
    (view: ViewMode, activityLabel = `OPEN ${view.toUpperCase()}`) => {
      setActiveView(view);
      appendActivity(activityLabel);
    },
    [appendActivity]
  );

  const handleSelectAsset = useCallback(
    (
      asset: InfrastructureAsset,
      activityLabel = `SELECT ${getAssetTypeLabel(asset)} ${asset.name.toUpperCase()}`
    ) => {
      setIsRightSidebarOpen(true);
      dispatch({
        type: "focusDataset",
        focusedDatasetId: asset.datasetId
      });

      if (!workspaceState.activeDatasetIds.includes(asset.datasetId)) {
        dispatch({
          type: "toggleDataset",
          datasetId: asset.datasetId,
          fallbackFocusedDatasetId: asset.datasetId,
          validDatasetIds: availableDatasetIds
        });
      }

      dispatch({
        type: "selectAsset",
        selectedAssetId: asset.id
      });
      setActiveView("map");
      appendActivity(activityLabel);
    },
    [appendActivity, availableDatasetIds, workspaceState.activeDatasetIds]
  );

  const handleSelectSearchResult = useCallback(
    (asset: InfrastructureAsset) => {
      handleSelectAsset(asset);
      dispatch({
        type: "setSearchQuery",
        query: ""
      });
    },
    [handleSelectAsset]
  );

  // Entry points from OUTSIDE any overlay (grid rows, dashboard
  // tables, right-rail panel clicks) reset the navigation stack.
  // This is "start a fresh drill-down" semantics — no back history.
  const handleInspectAsset = useCallback(
    (asset: InfrastructureAsset) => {
      setOverlayStack([{ kind: "asset", asset }]);
      appendActivity(`INSPECT ${getAssetTypeLabel(asset)} ${asset.name.toUpperCase()}`);
    },
    [appendActivity]
  );

  const handleInspectCompany = useCallback(
    (company: CompanyProfile) => {
      setOverlayStack([{ kind: "company", company }]);
      appendActivity(`INSPECT OPERATOR ${company.name.toUpperCase()}`);
    },
    [appendActivity]
  );

  const handleInspectCountry = useCallback(
    (country: CountryProfile) => {
      setOverlayStack([{ kind: "country", country }]);
      appendActivity(`INSPECT COUNTRY ${country.name.toUpperCase()}`);
    },
    [appendActivity]
  );

  // Entry points from INSIDE an overlay (clicking OPERATOR / COUNTRY
  // cells inside the asset overlay) push onto the existing stack
  // so the user can walk back via the BACK button.
  const handleDrillIntoCompany = useCallback(
    (company: CompanyProfile) => {
      setOverlayStack((prev) => [...prev, { kind: "company", company }]);
      appendActivity(`DRILL OPERATOR ${company.name.toUpperCase()}`);
    },
    [appendActivity]
  );

  const handleDrillIntoCountry = useCallback(
    (country: CountryProfile) => {
      setOverlayStack((prev) => [...prev, { kind: "country", country }]);
      appendActivity(`DRILL COUNTRY ${country.name.toUpperCase()}`);
    },
    [appendActivity]
  );

  const handleCloseOverlay = useCallback(() => {
    setOverlayStack([]);
  }, []);

  const handlePopOverlay = useCallback(() => {
    setOverlayStack((prev) => prev.slice(0, -1));
  }, []);

  const handleToggleDataset = useCallback(
    (datasetId: DatasetId, activityLabel = `TOGGLE DATASET ${datasetId.toUpperCase()}`) => {
      dispatch({
        type: "toggleDataset",
        datasetId,
        fallbackFocusedDatasetId: availableDatasetIds[0] ?? datasetId,
        validDatasetIds: availableDatasetIds
      });
      appendActivity(activityLabel);
    },
    [appendActivity, availableDatasetIds]
  );

  const handleActivateDataset = useCallback(
    (datasetId: DatasetId, activityLabel = `FOCUS DATASET ${datasetId.toUpperCase()}`) => {
      dispatch({
        type: "focusDataset",
        focusedDatasetId: datasetId
      });

      if (!workspaceState.activeDatasetIds.includes(datasetId)) {
        dispatch({
          type: "toggleDataset",
          datasetId,
          fallbackFocusedDatasetId: datasetId,
          validDatasetIds: availableDatasetIds
        });
      }

      appendActivity(activityLabel);
    },
    [appendActivity, availableDatasetIds, workspaceState.activeDatasetIds]
  );

  const handleRegionChange = useCallback(
    (next: RegionCode) => {
      if (next === activeRegion) return;
      setActiveRegion(next);
      appendActivity(`REGION ${formatRegionLabel(next)}`);
    },
    [activeRegion, appendActivity]
  );

  const handleClearSelection = useCallback(() => {
    if (!workspaceState.selectedAssetId) {
      return;
    }
    dispatch({
      type: "selectAsset",
      selectedAssetId: null
    });
    appendActivity("CLEAR SELECTION");
  }, [appendActivity, workspaceState.selectedAssetId]);

  const handleFilterChange = useCallback(
    (datasetId: DatasetId, field: string, value: string) => {
      dispatch({
        type: "setDatasetFilter",
        datasetId,
        field,
        query: value
      });
    },
    []
  );

  const handleCommandSubmit = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return;
      }

      const resolution = resolveTerminalCommand(normalizedQuery, assets);

      if (resolution?.kind === "view") {
        handleChangeView(resolution.view, resolution.activityLabel);
      } else if (resolution?.kind === "dataset") {
        handleActivateDataset(resolution.datasetId, resolution.activityLabel);
      } else if (resolution?.kind === "asset") {
        const asset = assets.find((candidate) => candidate.id === resolution.assetId);

        if (asset) {
          handleSelectAsset(asset, resolution.activityLabel);
        }
      } else if (searchResults.length > 0) {
        handleSelectAsset(
          searchResults[0],
          `SELECT ${getAssetTypeLabel(searchResults[0])} ${searchResults[0].name.toUpperCase()}`
        );
      } else {
        // Silent failure erodes trust in a command bar. Log the miss so the
        // user sees the terminal "heard" their keystroke even when it can't
        // act on it.
        appendActivity(`COMMAND NOT FOUND: ${normalizedQuery.toUpperCase()}`);
      }

      dispatch({
        type: "setSearchQuery",
        query: ""
      });
    },
    [
      appendActivity,
      assets,
      handleActivateDataset,
      handleChangeView,
      handleSelectAsset,
      searchResults
    ]
  );

  // Keyboard shortcuts removed in the shell-polish pass — the
  // in-UI affordances (TopNav tabs, command bar, LeftRail toggles)
  // are the single source of navigation. Re-add selectively if a
  // specific shortcut earns its discoverability cost.

  // Tick the header clocks once per second.
  useEffect(() => {
    const id = window.setInterval(() => setNowStamp(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const regionalSnapshotInputs = useMemo(
    () => ({
      bypassResult: bypassModel.isScenarioActive ? bypassModel.result : null,
      disruptionPct: bypassModel.disruptionPercentage,
      hormuzBaselineMbpd: DEFAULT_BYPASS_CONSTANTS.hormuzCrudeFlowMbpd,
      firmsAlertCount:
        firms.snapshot?.anomalies.filter((a) => a.severity !== "NORMAL").length ?? 0
    }),
    [bypassModel.isScenarioActive, bypassModel.result, bypassModel.disruptionPercentage, firms.snapshot]
  );

  // Proper type predicates so downstream page props stay narrowed
  // (RefineryAsset / ChokepointAsset) without needing `as never`
  // escape hatches. See the code-review finding in PR #3.
  const refineryAssets = useMemo(
    () => assets.filter((a): a is RefineryAsset => a.assetKind === "refinery"),
    [assets]
  );
  const chokepointAssets = useMemo(
    () => assets.filter((a): a is ChokepointAsset => a.assetKind === "chokepoint"),
    [assets]
  );
  const firmsAnomalies = firms.snapshot?.anomalies ?? [];
  const marketMode: "LIVE" | "STATIC_SNAPSHOT" =
    crudePrices.summary?.classification === "OBSERVED" ? "LIVE" : "STATIC_SNAPSHOT";

  let mainContent: React.ReactNode;
  switch (activeView) {
    case "map":
      mainContent = (
        <MapPage
          activeDatasetIds={workspaceState.activeDatasetIds}
          appendActivity={appendActivity}
          basemapMode={basemapMode}
          firmsSnapshot={firms.snapshot}
          gridDatasetId={gridDatasetId}
          gridRows={gridRows}
          hasError={Boolean(error)}
          isAssetGridOpen={isAssetGridOpen}
          latestUpdate={lastUpdate}
          mapDisplaySettings={mapDisplaySettings}
          onClearSelection={() => dispatch({ type: "selectAsset", selectedAssetId: null })}
          onInspectAsset={handleInspectAsset}
          onSelectAsset={handleSelectAsset}
          onSelectBasemap={setBasemapMode}
          onToggleAssetGrid={() => setIsAssetGridOpen((current) => !current)}
          outageEvents={outageEvents.snapshot?.events ?? null}
          regionalSnapshot={regionalSnapshotInputs}
          scenarioState={scenarioVisualState}
          selectedAssetId={workspaceState.selectedAssetId}
          visibleAssets={visibleAssets}
        />
      );
      break;
    case "markets":
      mainContent = (
        <MarketsPage
          brentHistoricalSeries={brentHistorical.snapshot?.series.brent ?? []}
          brentWtiSnapshot={crudePrices.snapshot}
          dmeOmanSnapshot={crudePrices.dmeOmanSnapshot}
          iceSnapshot={iceSettlements.snapshot}
          mode={marketMode}
          murbanSnapshot={crudePrices.murbanSnapshot}
          summary={crudePrices.summary}
          timespreads={iceSettlements.timespreads}
        />
      );
      break;
    case "events":
      mainContent = (
        <EventsPage
          firmsAnomalies={firmsAnomalies}
          outageEvents={outageEvents.snapshot?.events ?? []}
          timeT={timeT}
        />
      );
      break;
    case "models":
      mainContent = (
        <ModelsPage
          bypassModel={bypassModel}
          onNavigateToMap={() => handleChangeView("map", "OPEN MAP")}
          outageEvents={outageEvents.snapshot?.events ?? []}
        />
      );
      break;
    case "chokes":
      mainContent = (
        <ChokesPage
          chokepoints={chokepointAssets}
          onSelectChokepoint={(cp) => appendActivity(`INSPECT CHOKEPOINT ${cp.name.toUpperCase()}`)}
        />
      );
      break;
    case "flows":
      mainContent = <FlowsPage />;
      break;
    case "ais":
      mainContent = <AisPage />;
      break;
    case "alerts":
      mainContent = (
        <AlertsPage
          onAlertCreated={(rule) => appendActivity(`ALERT ARMED · ${rule.name.toUpperCase()}`)}
        />
      );
      break;
    case "notes":
      mainContent = (
        <NotesPage onNoteSaved={(bytes) => {
          if (bytes > 0 && bytes % 512 === 0) appendActivity(`NOTES SAVED · ${bytes} CHARS`);
        }} />
      );
      break;
    case "about":
      mainContent = <AboutPage />;
      break;
    case "data":
      mainContent = <DataPage />;
      break;
    case "reference":
      mainContent = (
        <ReferencePage
          onInspectRefinery={handleInspectAsset}
          refineries={refineryAssets}
        />
      );
      break;
    default:
      mainContent = null;
  }

  // Dataset counts for the LeftRail — reflects the full workspace
  // dataset rather than the currently-filtered visible subset so the
  // counts stay stable as filters change.
  const datasetCounts: Record<DatasetId, number> = useMemo(() => {
    const counts: Record<DatasetId, number> = {
      refineries: 0,
      pipelines: 0,
      fields: 0,
      terminals: 0,
      chokepoints: 0
    };
    for (const asset of assets) {
      counts[asset.datasetId] += 1;
    }
    return counts;
  }, [assets]);

  // Watchlist for the LeftRail — curated from the top outage events +
  // FIRMS anomalies so it reflects live state rather than a static list.
  const watchlistItems: WatchlistItem[] = useMemo(() => {
    const fromOutages: WatchlistItem[] = (outageEvents.snapshot?.events ?? [])
      .slice(0, 3)
      .map((event) => ({
        id: `outage-${event.id}`,
        label: event.name.length > 24 ? `${event.name.slice(0, 22)}…` : event.name,
        status:
          event.severity === "CRITICAL" || event.severity === "HIGH"
            ? "alert"
            : event.severity === "MEDIUM"
              ? "elevated"
              : "nominal",
        note: event.country
      }));
    const fromFirms: WatchlistItem[] = (firms.snapshot?.anomalies ?? [])
      .filter((a) => a.severity !== "NORMAL")
      .slice(0, 2)
      .map((a) => ({
        id: `firms-${a.asset.id}`,
        label: a.asset.name.length > 24 ? `${a.asset.name.slice(0, 22)}…` : a.asset.name,
        status: a.severity === "ALERT" ? "alert" : "elevated",
        note: `${a.ratioToBaseline.toFixed(1)}×`
      }));
    return [...fromOutages, ...fromFirms].slice(0, 5);
  }, [firms.snapshot, outageEvents.snapshot]);

  const localTime = nowStamp.toLocaleTimeString("en-GB", { hour12: false });
  const utcTime = nowStamp.toISOString().slice(11, 19);
  const sessionDate = nowStamp
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  return (
    <AppShellLayout
      header={
        <TopNav
          activeView={activeView}
          isScenarioActive={bypassModel.isScenarioActive}
          localTime={localTime}
          onChangeView={handleChangeView}
          onCommandSubmit={handleCommandSubmit}
          onSearchQueryChange={(query) =>
            dispatch({
              type: "setSearchQuery",
              query
            })
          }
          onSelectSearchResult={handleSelectSearchResult}
          scenarioDisruptionPct={bypassModel.disruptionPercentage}
          searchInputRef={searchInputRef}
          searchQuery={workspaceState.searchQuery}
          searchResults={searchResults}
          sessionDate={sessionDate}
          utcTime={utcTime}
        />
      }
      isLeftSidebarOpen={isLeftSidebarOpen}
      isRightSidebarOpen={isRightSidebarOpen}
      onToggleLeftSidebar={() => setIsLeftSidebarOpen((current) => !current)}
      onToggleRightSidebar={() => setIsRightSidebarOpen((current) => !current)}
      marketTape={
        <MarketTape
          error={crudePrices.error}
          isLoading={crudePrices.isLoading}
          summary={crudePrices.summary}
          timespreads={iceSettlements.timespreads}
        />
      }
      leftSidebar={
        <LeftRail
          activeDatasetIds={workspaceState.activeDatasetIds}
          activeRegion={activeRegion}
          datasetCounts={datasetCounts}
          onSelectRegion={handleRegionChange}
          onToggleDataset={handleToggleDataset}
          watchlist={watchlistItems}
        />
      }
      mainContent={mainContent}
      rightSidebar={
        <div className={styles.sidebarStack}>
          {selectedAsset ? (
            <>
              <ClearSelectionBar
                asset={selectedAsset}
                onClear={handleClearSelection}
              />
              <ContextPanelStack
                companiesById={companiesById}
                countriesByCode={countriesByCode}
                exposureByTargetId={exposureByTargetId}
                firmsSnapshot={firms.snapshot}
                outageEvents={outageEvents.snapshot}
                onInspectCompany={handleInspectCompany}
                onInspectCountry={handleInspectCountry}
                selectedAsset={selectedAsset}
              />
            </>
          ) : activeView === "map" ? (
            /* MAP view keeps the market modules + filters on the right
               rail so the map workspace is information-dense at rest. */
            <>
              <MarketModulesStack
                brentWtiSnapshot={crudePrices.snapshot}
                dmeOmanSnapshot={crudePrices.dmeOmanSnapshot}
                firmsAnomalies={firms.snapshot?.anomalies ?? []}
                iceSnapshot={iceSettlements.snapshot}
                mode={marketMode}
                murbanSnapshot={crudePrices.murbanSnapshot}
                outageEvents={outageEvents.snapshot?.events ?? []}
                summary={crudePrices.summary}
                timespreads={iceSettlements.timespreads}
              />
              <MapContentPanel
                activeDatasetIds={workspaceState.activeDatasetIds}
                assets={assets}
                filtersByDataset={workspaceState.filtersByDataset}
                focusedDataset={focusedDataset}
                onFilterChange={handleFilterChange}
                onToggleDataset={handleToggleDataset}
              />
              <MapDisplayControls
                onChange={setMapDisplaySettings}
                settings={mapDisplaySettings}
              />
            </>
          ) : null}
        </div>
      }
      statusBar={
        <>
          {/* Timeline scrubber renders ABOVE the status strip — the
              Bloomberg-style bottom bar stacks timeline (row 1) over
              session status (row 2). Read-only surface for now: plots
              Brent history with outage-event overlay, no playhead. */}
          <TimelineScrubber
            brentSeries={brentHistorical.snapshot?.series.brent ?? []}
            onScrub={(t) => {
              const wasAtNow = timeT >= 0.999;
              const nowAtNow = t >= 0.999;
              setTimeT(t);
              // Log only on transitions between NOW ↔ REWOUND so drag
              // ticks don't flood the activity log.
              if (wasAtNow && !nowAtNow) appendActivity("TIME MACHINE ENGAGED");
              else if (!wasAtNow && nowAtNow) appendActivity("TIME MACHINE RESET");
            }}
            outageEvents={outageEvents.snapshot?.events ?? []}
            timeT={timeT}
          />
          <StatusBar
            activeAssetCount={visibleAssets.length}
            activeDatasetCount={workspaceState.activeDatasetIds.length}
            firmsSnapshot={firms.snapshot}
            hasError={Boolean(error)}
            lastUpdate={lastUpdate}
            latestActivity={activityLog[0] ?? null}
            marketSummary={crudePrices.summary}
          />
        </>
      }
    >
      {currentOverlay?.kind === "asset" ? (
        <AssetDetailOverlay
          asset={currentOverlay.asset}
          canGoBack={canGoBackOverlay}
          companiesById={companiesById}
          countriesByCode={countriesByCode}
          exposureByTargetId={exposureByTargetId}
          firmsSnapshot={firms.snapshot}
          outageEvents={outageEvents.snapshot}
          onBack={handlePopOverlay}
          onClose={handleCloseOverlay}
          onInspectCompany={handleDrillIntoCompany}
          onInspectCountry={handleDrillIntoCountry}
          onViewOnMap={handleSelectAsset}
        />
      ) : null}
      {currentOverlay?.kind === "grade" ? (
        <GradeDetailOverlay
          grade={currentOverlay.grade}
          canGoBack={canGoBackOverlay}
          onBack={handlePopOverlay}
          onClose={handleCloseOverlay}
        />
      ) : null}
      {currentOverlay?.kind === "company" ? (
        <CompanyDetailOverlay
          company={currentOverlay.company}
          canGoBack={canGoBackOverlay}
          onBack={handlePopOverlay}
          onClose={handleCloseOverlay}
        />
      ) : null}
      {currentOverlay?.kind === "country" ? (
        <CountryDetailOverlay
          country={currentOverlay.country}
          canGoBack={canGoBackOverlay}
          exposureEntry={exposureByTargetId[currentOverlay.country.code]}
          onBack={handlePopOverlay}
          onClose={handleCloseOverlay}
        />
      ) : null}
    </AppShellLayout>
  );
}

// `ContextlessGridView` removed — the old standalone TABLE view is
// gone; the asset grid lives only inside MapPage's MapWorkspaceMain.

function workspaceReducer(state: MapWorkspaceState, action: WorkspaceAction): MapWorkspaceState {
  if (action.type === "hydrateCatalog") {
    const validDatasetIds = action.validDatasetIds ?? [];
    const defaultActiveDatasetIds = action.activeDatasetIds?.filter((datasetId) => validDatasetIds.includes(datasetId)) ?? [];
    const nextActiveDatasetIds = state.activeDatasetIds.filter((datasetId) => validDatasetIds.includes(datasetId));

    return {
      ...state,
      activeDatasetIds:
        nextActiveDatasetIds.length > 0
          ? nextActiveDatasetIds
          : defaultActiveDatasetIds.length > 0
            ? defaultActiveDatasetIds
            : validDatasetIds,
      focusedDatasetId:
        validDatasetIds.includes(state.focusedDatasetId) && !action.focusedDatasetId
          ? state.focusedDatasetId
          : action.focusedDatasetId ?? state.focusedDatasetId
    };
  }

  if (action.type === "focusDataset" && action.focusedDatasetId) {
    return {
      ...state,
      focusedDatasetId: action.focusedDatasetId
    };
  }

  if (action.type === "toggleDataset" && action.datasetId) {
    const validDatasetIds = action.validDatasetIds ?? state.activeDatasetIds;
    const isActive = state.activeDatasetIds.includes(action.datasetId);
    const nextActiveDatasetIds = isActive
      ? state.activeDatasetIds.filter((datasetId) => datasetId !== action.datasetId)
      : [...state.activeDatasetIds, action.datasetId].filter((datasetId, index, ids) => ids.indexOf(datasetId) === index);
    const normalizedActiveDatasetIds = nextActiveDatasetIds.filter((datasetId) => validDatasetIds.includes(datasetId));

    return {
      ...state,
      activeDatasetIds: normalizedActiveDatasetIds,
      focusedDatasetId:
        state.focusedDatasetId === action.datasetId && normalizedActiveDatasetIds.length === 0
          ? action.fallbackFocusedDatasetId ?? state.focusedDatasetId
          : state.focusedDatasetId
    };
  }

  if (action.type === "setDatasetFilter" && action.datasetId && action.field) {
    const nextDatasetFilters = {
      ...state.filtersByDataset[action.datasetId],
      [action.field]: action.query ?? ""
    } as DatasetFiltersById[typeof action.datasetId];

    return {
      ...state,
      filtersByDataset: {
        ...state.filtersByDataset,
        [action.datasetId]: nextDatasetFilters
      },
      selectedAssetId: null
    };
  }

  if (action.type === "setSearchQuery") {
    return {
      ...state,
      searchQuery: action.query ?? ""
    };
  }

  if (action.type === "selectAsset") {
    return {
      ...state,
      selectedAssetId: action.selectedAssetId ?? null
    };
  }

  return state;
}

// Keyboard shortcut maps removed — the command bar handles view
// navigation via typed commands (see `src/utils/commandBar.ts`).
