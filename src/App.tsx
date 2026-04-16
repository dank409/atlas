import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { HeaderBar } from "./components/layout/HeaderBar";
import { StatusBar } from "./components/layout/StatusBar";
import { DashboardView } from "./components/layout/DashboardView";
import { Panel } from "./components/common/Panel";
import { SidebarTabs, type SidebarTabOption } from "./components/common/SidebarTabs";
import { DatasetCatalogPanel } from "./components/panels/DatasetCatalogPanel";
import { MapContentPanel } from "./components/panels/MapContentPanel";
import { MapDisplayControls } from "./components/panels/MapDisplayControls";
import { ContextPanelStack } from "./components/panels/ContextPanelStack";
import { ClearSelectionBar } from "./components/panels/ClearSelectionBar";
import { AssetGridTable } from "./components/tables/AssetGridTable";
import { AssetDetailOverlay } from "./components/tables/AssetDetailOverlay";
import { CrudeGradeTable } from "./components/tables/CrudeGradeTable";
import { GradeDetailOverlay } from "./components/tables/GradeDetailOverlay";
import { CompanyDetailOverlay } from "./components/panels/CompanyDetailOverlay";
import { CountryDetailOverlay } from "./components/panels/CountryDetailOverlay";
import type { CrudeGrade } from "./types/CrudeGrade";
import { useMapWorkspaceData } from "./hooks/useMapWorkspaceData";
import { ViewMode } from "./types/View";
import { AppShellLayout } from "./components/layout/AppShellLayout";
import { MapLoadingFallback } from "./components/layout/MapLoadingFallback";
import { BASEMAP_MODE_LABELS, type BasemapMode } from "./components/map/MapView";
import { ShortcutOverlay } from "./components/layout/ShortcutOverlay";

// MapWorkspaceMain (and everything it transitively imports, including
// mapbox-gl via MapView) is code-split into its own async chunk. Users
// who open the terminal in TABLE / DASH / GRADES view never download
// the map engine bundle at all — the lazy import only fires when
// activeView === "map" is first evaluated.
const MapWorkspaceMain = lazy(() =>
  import("./components/layout/MapWorkspaceMain").then((module) => ({
    default: module.MapWorkspaceMain
  }))
);
import { MarketTape } from "./components/market/MarketTape";
import { BypassControlPanel } from "./components/model/BypassControlPanel";
import { useCrudePrices } from "./hooks/useCrudePrices";
import { useCrudeGrades } from "./hooks/useCrudeGrades";
import { useIceSettlements } from "./hooks/useIceSettlements";
import { useBypassModel } from "./hooks/useBypassModel";
import { useOutageEvents } from "./hooks/useOutageEvents";
import { useBrentHistorical } from "./hooks/useBrentHistorical";
import { useFirms } from "./hooks/useFirms";
import type { TerminalActivityEntry } from "./types/Activity";
import type { FirmsWindowHours } from "./types/firms";
import { DEFAULT_MAP_DISPLAY_SETTINGS, type MapDisplaySettings } from "./types/mapDisplaySettings";
import type {
  CompanyProfile,
  CountryProfile,
  DatasetFiltersById,
  DatasetId,
  InfrastructureAsset,
  MapWorkspaceState
} from "./types/Infrastructure";
import {
  DEFAULT_DATASET_FILTERS,
  buildAssetGridRows,
  buildSearchResults,
  filterAssets,
  getAssetTypeLabel
} from "./utils/infrastructure";
import { resolveTerminalCommand } from "./utils/commandBar";
import styles from "./App.module.css";

type LeftSidebarTab = "catalog" | "scenarios";

const LEFT_SIDEBAR_TABS: SidebarTabOption<LeftSidebarTab>[] = [
  { value: "catalog", label: "CATALOG" },
  { value: "scenarios", label: "SCENARIOS" }
];

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
  const { assets, catalog, companiesById, countriesByCode, firmsBaselineByAssetId, error } = useMapWorkspaceData();
  const crudePrices = useCrudePrices();
  const crudeGrades = useCrudeGrades();
  const iceSettlements = useIceSettlements();
  const bypassModel = useBypassModel();
  const outageEvents = useOutageEvents();
  const brentHistorical = useBrentHistorical();
  const [activeView, setActiveView] = useState<ViewMode>("map");
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("dark");
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isAssetGridOpen, setIsAssetGridOpen] = useState(true);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
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
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>("catalog");
  const [activityLog, setActivityLog] = useState<TerminalActivityEntry[]>([]);
  // FIRMS runtime controls. Defaults match CLAUDE.md FIRMS notes: 72h
  // window, confidence >= 80, layer enabled on mount.
  const [firmsWindowHours, setFirmsWindowHours] = useState<FirmsWindowHours>(72);
  const [firmsConfidenceThreshold, setFirmsConfidenceThreshold] = useState<number>(80);
  const [isFirmsLayerEnabled, setIsFirmsLayerEnabled] = useState<boolean>(true);
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
  const visibleAssets = useMemo(
    () => filterAssets(assets, workspaceState.activeDatasetIds, workspaceState.filtersByDataset),
    [assets, workspaceState.activeDatasetIds, workspaceState.filtersByDataset]
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

  const handleInspectGrade = useCallback(
    (grade: CrudeGrade) => {
      setOverlayStack([{ kind: "grade", grade }]);
      appendActivity(`INSPECT GRADE ${grade.name.toUpperCase()}`);
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

  const handleFocusDataset = useCallback(
    (datasetId: DatasetId, activityLabel = `FOCUS DATASET ${datasetId.toUpperCase()}`) => {
      dispatch({
        type: "focusDataset",
        focusedDatasetId: datasetId
      });
      appendActivity(activityLabel);
    },
    [appendActivity]
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

  const handleLeftSidebarTabChange = useCallback(
    (next: LeftSidebarTab) => {
      if (next === leftSidebarTab) {
        return;
      }
      setLeftSidebarTab(next);
      appendActivity(`SIDEBAR ${next.toUpperCase()}`);
    },
    [appendActivity, leftSidebarTab]
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

  const handleBypassDisruptionChange = useCallback(
    (value: number) => {
      const wasActive = bypassModel.disruptionPercentage > 0;
      bypassModel.setDisruptionPercentage(value);

      // Activity log gets one entry on activation and one on deactivation —
      // logging every drag tick would flood the trace. The slider's live
      // numeric readout already covers intermediate values.
      if (!wasActive && value > 0) {
        appendActivity(`SCENARIO ENGAGED · HORMUZ ${value.toFixed(0)}%`);
      } else if (wasActive && value === 0) {
        appendActivity("SCENARIO RELEASED · HORMUZ 0%");
      }
    },
    [appendActivity, bypassModel]
  );

  const handleFirmsWindowChange = useCallback(
    (value: FirmsWindowHours) => {
      setFirmsWindowHours(value);
      appendActivity(`FIRMS WINDOW ${value === 24 ? "24H" : value === 72 ? "72H" : "7D"}`);
    },
    [appendActivity]
  );

  const handleFirmsConfidenceChange = useCallback(
    (value: number) => {
      setFirmsConfidenceThreshold(value);
      // Logged only on the release events; the slider fires many per
      // drag but the panel surfaces the live value already.
    },
    []
  );

  const handleFirmsLayerToggle = useCallback(() => {
    setIsFirmsLayerEnabled((current) => {
      const next = !current;
      appendActivity(next ? "TOGGLE FIRMS ON" : "TOGGLE FIRMS OFF");
      return next;
    });
  }, [appendActivity]);

  const handleBypassReset = useCallback(() => {
    bypassModel.resetScenario();
    appendActivity("SCENARIO RESET");
  }, [appendActivity, bypassModel]);

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

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      const normalizedKey = event.key.toLowerCase();
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement);

      if (normalizedKey === "escape") {
        event.preventDefault();
        setIsShortcutHelpOpen(false);

        if (workspaceState.selectedAssetId) {
          dispatch({
            type: "selectAsset",
            selectedAssetId: null
          });
        }

        return;
      }

      if (isTypingTarget) {
        return;
      }

      if (normalizedKey === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (normalizedKey === "?") {
        event.preventDefault();
        setIsShortcutHelpOpen((current) => !current);
        return;
      }

      if (normalizedKey === "]") {
        event.preventDefault();
        setIsRightSidebarOpen((current) => !current);
        return;
      }

      if (normalizedKey === "[") {
        event.preventDefault();
        setIsLeftSidebarOpen((current) => !current);
        return;
      }

      if (normalizedKey === "\\") {
        event.preventDefault();
        setIsAssetGridOpen((current) => !current);
        return;
      }

      if (normalizedKey === "f") {
        event.preventDefault();
        handleFirmsLayerToggle();
        return;
      }

      const shortcutDatasetId = KEYBOARD_SHORTCUT_DATASET[normalizedKey];

      if (shortcutDatasetId && availableDatasetIds.includes(shortcutDatasetId)) {
        event.preventDefault();
        dispatch({
          type: "toggleDataset",
          datasetId: shortcutDatasetId,
          fallbackFocusedDatasetId: availableDatasetIds[0] ?? shortcutDatasetId,
          validDatasetIds: availableDatasetIds
        });
        appendActivity(`TOGGLE DATASET ${shortcutDatasetId.toUpperCase()}`);
        return;
      }

      const nextView = KEYBOARD_SHORTCUT_VIEW[normalizedKey];

      if (!nextView) {
        return;
      }

      event.preventDefault();
      handleChangeView(nextView, nextView === "dash" ? "OPEN DASHBOARD" : `OPEN ${nextView.toUpperCase()}`);
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [appendActivity, availableDatasetIds, handleChangeView, handleFirmsLayerToggle, workspaceState.selectedAssetId]);

  const mainContent =
    activeView === "dash" ? (
      <DashboardView
        brentHistorical={brentHistorical.snapshot}
        bypassResult={bypassModel.result}
        firmsSnapshot={firms.snapshot}
        firmsIsLoading={firms.isLoading}
        firmsError={firms.error}
        firmsWindowHours={firmsWindowHours}
        firmsConfidenceThreshold={firmsConfidenceThreshold}
        isFirmsLayerEnabled={isFirmsLayerEnabled}
        onFirmsWindowChange={handleFirmsWindowChange}
        onFirmsConfidenceChange={handleFirmsConfidenceChange}
        onFirmsLayerToggle={handleFirmsLayerToggle}
        iceSettlements={iceSettlements.snapshot}
        isScenarioActive={bypassModel.isScenarioActive}
        lastUpdate={lastUpdate}
        marketSummary={crudePrices.summary}
        outageEvents={outageEvents.snapshot}
        onInspectAsset={handleInspectAsset}
        visibleAssets={visibleAssets}
      />
    ) : activeView === "grades" ? (
      <div className={styles.fullHeightPanel}>
        <Panel title="CRUDE GRADE REFERENCE" badge={`${crudeGrades.snapshot?.grades.length ?? 0} GRADES`}>
          <CrudeGradeTable
            error={crudeGrades.error}
            isLoading={crudeGrades.isLoading}
            onInspectGrade={handleInspectGrade}
            snapshot={crudeGrades.snapshot}
          />
        </Panel>
      </div>
    ) : activeView === "table" ? (
      <div className={styles.fullHeightPanel}>
        <ContextlessGridView
          activeDatasetIds={workspaceState.activeDatasetIds}
          gridDatasetId={gridDatasetId}
          gridRows={gridRows}
          latestUpdate={lastUpdate}
          onInspectAsset={handleInspectAsset}
          onSelectAsset={handleSelectAsset}
          selectedAssetId={workspaceState.selectedAssetId}
        />
      </div>
    ) : (
      <Suspense fallback={<MapLoadingFallback />}>
        <MapWorkspaceMain
          activeDatasetIds={workspaceState.activeDatasetIds}
          gridDatasetId={gridDatasetId}
          gridRows={gridRows}
          hasError={Boolean(error)}
          basemapMode={basemapMode}
          isAssetGridOpen={isAssetGridOpen}
          onToggleAssetGrid={() => setIsAssetGridOpen((current) => !current)}
          latestUpdate={lastUpdate}
          onClearSelection={() =>
            dispatch({
              type: "selectAsset",
              selectedAssetId: null
            })
          }
          onInspectAsset={handleInspectAsset}
          onSelectAsset={handleSelectAsset}
          onSelectBasemap={(mode) => {
            setBasemapMode((current) => {
              if (current === mode) return current;
              appendActivity(`BASEMAP ${BASEMAP_MODE_LABELS[mode]}`);
              return mode;
            });
          }}
          outageEvents={outageEvents.snapshot?.events ?? null}
          firmsSnapshot={firms.snapshot}
          scenarioState={scenarioVisualState}
          selectedAssetId={workspaceState.selectedAssetId}
          visibleAssets={visibleAssets}
          mapDisplaySettings={mapDisplaySettings}
        />
      </Suspense>
    );

  return (
    <AppShellLayout
      header={
        <HeaderBar
          activeView={activeView}
          isScenarioActive={bypassModel.isScenarioActive}
          scenarioDisruptionPct={bypassModel.disruptionPercentage}
          onChangeView={handleChangeView}
          onCommandSubmit={handleCommandSubmit}
          onSearchQueryChange={(query) =>
            dispatch({
              type: "setSearchQuery",
              query
            })
          }
          onSelectSearchResult={handleSelectSearchResult}
          searchInputRef={searchInputRef}
          searchQuery={workspaceState.searchQuery}
          searchResults={searchResults}
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
        />
      }
      leftSidebar={
        <div className={styles.sidebarStack}>
          <SidebarTabs
            active={leftSidebarTab}
            ariaLabel="Left sidebar mode"
            onChange={handleLeftSidebarTabChange}
            options={
              bypassModel.isScenarioActive
                ? [
                    { value: "catalog", label: "CATALOG" },
                    { value: "scenarios", label: "SCENARIOS", badge: "ACTIVE" }
                  ]
                : LEFT_SIDEBAR_TABS
            }
          />
          {leftSidebarTab === "catalog" ? (
            <DatasetCatalogPanel
              activeDatasetIds={workspaceState.activeDatasetIds}
              catalog={catalog}
              focusedDatasetId={workspaceState.focusedDatasetId}
              onFocusDataset={handleFocusDataset}
              onToggleDataset={handleToggleDataset}
            />
          ) : (
            <BypassControlPanel
              disruptionPercentage={bypassModel.disruptionPercentage}
              ieaReleaseRate={bypassModel.ieaReleaseRate}
              onDisruptionChange={handleBypassDisruptionChange}
              onIeaChange={bypassModel.setIeaReleaseRate}
              onReset={handleBypassReset}
              onSaudiChange={bypassModel.setSaudiUtilization}
              onUaeChange={bypassModel.setUaeUtilization}
              result={bypassModel.result}
              saudiUtilization={bypassModel.saudiUtilization}
              uaeUtilization={bypassModel.uaeUtilization}
            />
          )}
        </div>
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
                onInspectCompany={handleInspectCompany}
                onInspectCountry={handleInspectCountry}
                selectedAsset={selectedAsset}
              />
            </>
          ) : (
            <>
              <MapContentPanel
                activeDatasetIds={workspaceState.activeDatasetIds}
                assets={assets}
                filtersByDataset={workspaceState.filtersByDataset}
                focusedDataset={focusedDataset}
                onFilterChange={handleFilterChange}
                onToggleDataset={handleToggleDataset}
              />
              <MapDisplayControls
                settings={mapDisplaySettings}
                onChange={setMapDisplaySettings}
              />
            </>
          )}
        </div>
      }
      statusBar={
        <StatusBar
          activeAssetCount={visibleAssets.length}
          activeDatasetCount={workspaceState.activeDatasetIds.length}
          hasError={Boolean(error)}
          lastUpdate={lastUpdate}
          latestActivity={activityLog[0] ?? null}
          marketSummary={crudePrices.summary}
          sourceCount={workspaceState.activeDatasetIds.length}
        />
      }
    >
      {isShortcutHelpOpen ? <ShortcutOverlay /> : null}
      {currentOverlay?.kind === "asset" ? (
        <AssetDetailOverlay
          asset={currentOverlay.asset}
          canGoBack={canGoBackOverlay}
          companiesById={companiesById}
          countriesByCode={countriesByCode}
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
          onBack={handlePopOverlay}
          onClose={handleCloseOverlay}
        />
      ) : null}
    </AppShellLayout>
  );
}

function ContextlessGridView({
  activeDatasetIds,
  gridRows,
  latestUpdate,
  onInspectAsset,
  onSelectAsset,
  gridDatasetId,
  selectedAssetId
}: {
  activeDatasetIds: DatasetId[];
  gridDatasetId: DatasetId | null;
  gridRows: ReturnType<typeof buildAssetGridRows>;
  latestUpdate: string;
  onInspectAsset?: (asset: InfrastructureAsset) => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  selectedAssetId: string | null;
}) {
  return (
    <Panel
      title="ASSET GRID"
      badge={`${gridRows.length} VISIBLE`}
    >
      <AssetGridTable
        activeDatasetCount={activeDatasetIds.length}
        gridDatasetId={gridDatasetId}
        latestUpdate={latestUpdate}
        onInspectAsset={onInspectAsset}
        onSelectAsset={onSelectAsset}
        rows={gridRows}
        selectedAssetId={selectedAssetId}
      />
    </Panel>
  );
}

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

const KEYBOARD_SHORTCUT_VIEW: Record<string, ViewMode> = {
  d: "dash",
  g: "grades",
  m: "map",
  t: "table"
};

const KEYBOARD_SHORTCUT_DATASET: Partial<Record<string, DatasetId>> = {
  "1": "refineries",
  "2": "pipelines",
  "3": "fields",
  "4": "terminals",
  "5": "chokepoints"
};
