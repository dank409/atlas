import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AppShellLayout } from "./components/layout/AppShellLayout";
import { LeftRail } from "./components/layout/LeftRail";
import { StatusBar } from "./components/layout/StatusBar";
import { TopNav } from "./components/layout/TopNav";
import type { BasemapMode } from "./components/map/MapView";
import { getAssetsBounds } from "./components/map/mapRegion";
import { AssetCard } from "./components/panels/AssetCard";
import { DATASET_CATALOG_SEED } from "./constants/datasetCatalog";
import { useCrudeGrades } from "./hooks/useCrudeGrades";
import { useMapWorkspaceData } from "./hooks/useMapWorkspaceData";
import { AboutPage } from "./pages/AboutPage";
import { ReferencePage } from "./pages/ReferencePage";
import { TablePage } from "./pages/TablePage";
import type { DatasetId, InfrastructureAsset } from "./types/Infrastructure";
import type { ReferenceLocation, ReferenceTab, ViewMode } from "./types/View";
import { ENERGY_TYPES, getEnergyType, type EnergyType } from "./utils/assetEnergy";
import { NO_FILTERS, applyAssetFilters, isInCountry, type AssetFilters } from "./utils/assetFilters";
import { countByDataset, countByEnergyType, filterAssets } from "./utils/infrastructure";
import { buildCountryIndex, buildOperatorIndex } from "./utils/referenceIndex";
import { buildWorkspaceSearchResults, type SearchResult } from "./utils/search";
import { buildUrlSearch, parseUrlState, type UrlState } from "./utils/urlState";
import styles from "./App.module.css";

// The map pulls in mapbox-gl, by far the largest dependency. Loading it
// lazily keeps it out of the initial bundle.
const MapView = lazy(() => import("./components/map/MapView").then((module) => ({ default: module.MapView })));

const ALL_DATASET_IDS = DATASET_CATALOG_SEED.map((entry) => entry.id);

interface WorkspaceState {
  activeDatasetIds: DatasetId[];
  activeEnergyTypes: EnergyType[];
  /** Country, operator and size filters, applied before the layer and energy toggles. */
  filters: AssetFilters;
  /** The layer the TABLE view is showing. */
  focusedDatasetId: DatasetId;
  selectedAssetId: string | null;
  /** Whether the map draws pipeline stretches that have no mapped route. */
  showUnmappedRoutes: boolean;
}

type WorkspaceAction =
  | { type: "toggleDataset"; datasetId: DatasetId }
  | { type: "toggleEnergyType"; energyType: EnergyType }
  | { type: "toggleUnmappedRoutes" }
  | { type: "setFilters"; filters: AssetFilters }
  | { type: "focusDataset"; datasetId: DatasetId }
  | { type: "showDataset"; datasetId: DatasetId }
  | { type: "selectAsset"; asset: InfrastructureAsset }
  | { type: "clearSelection" }
  | { type: "showAll" };

const INITIAL_WORKSPACE_STATE: WorkspaceState = {
  activeDatasetIds: ALL_DATASET_IDS,
  activeEnergyTypes: [...ENERGY_TYPES],
  filters: NO_FILTERS,
  focusedDatasetId: "refineries",
  selectedAssetId: null,
  showUnmappedRoutes: true
};

export function App() {
  const { assets, catalog, companies, countryProfiles, error, isLoading, operatorAliases } = useMapWorkspaceData();
  // Loaded here rather than in the Reference view so the header search can find grades.
  const crudeGrades = useCrudeGrades();
  // The address the app was opened at decides where it starts (see the URL effects below).
  const [initialUrlState] = useState(() => parseUrlState(window.location.search));
  const [workspace, dispatch] = useReducer(workspaceReducer, {
    ...INITIAL_WORKSPACE_STATE,
    focusedDatasetId: initialUrlState.layer ?? INITIAL_WORKSPACE_STATE.focusedDatasetId
  });
  const [activeView, setActiveView] = useState<ViewMode>(initialUrlState.view);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [referenceLocation, setReferenceLocation] = useState<ReferenceLocation>(() => toReferenceLocation(initialUrlState));
  // An asset named in the opening address can only be selected once the data has loaded.
  const pendingAssetIdRef = useRef(initialUrlState.assetId ?? null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

  // The Reference view's countries and operators are grouped from the
  // same assets the map shows, so its counts can never disagree with it.
  const operatorIndex = useMemo(
    () => buildOperatorIndex(assets, operatorAliases, companies),
    [assets, companies, operatorAliases]
  );
  const countryIndex = useMemo(
    () => buildCountryIndex(assets, countryProfiles, operatorIndex.operatorIdByAssetId),
    [assets, countryProfiles, operatorIndex]
  );
  // The filters narrow the data first; the counts beside the toggles follow them.
  const filteredAssets = useMemo(
    () => applyAssetFilters(assets, workspace.filters, operatorIndex.operatorIdByAssetId),
    [assets, operatorIndex, workspace.filters]
  );
  // Each filter's choices are counted within the other one, so a choice never leads to nothing.
  const countryOptions = useMemo(() => {
    const { operatorId } = workspace.filters;

    return countryIndex
      .map((country) => ({
        count: country.assets.filter(
          (asset) => operatorId === null || operatorIndex.operatorIdByAssetId[asset.id] === operatorId
        ).length,
        label: country.name,
        value: country.code
      }))
      .filter((option) => option.count > 0);
  }, [countryIndex, operatorIndex, workspace.filters]);
  const operatorOptions = useMemo(() => {
    const { countryCode } = workspace.filters;

    return operatorIndex.operators
      .map((operator) => ({
        count: operator.assets.filter((asset) => isInCountry(asset, countryCode)).length,
        label: operator.name,
        value: operator.id
      }))
      .filter((option) => option.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [operatorIndex, workspace.filters]);
  // Where the map should look while a country or operator is picked.
  const mapFocus = useMemo(() => {
    const { countryCode, operatorId } = workspace.filters;
    const bounds = countryCode || operatorId ? getAssetsBounds(filteredAssets) : null;

    return bounds ? { bounds, id: `${countryCode ?? ""}|${operatorId ?? ""}` } : null;
  }, [filteredAssets, workspace.filters]);
  // The one filtered set that both the map and the table show.
  const visibleAssets = useMemo(
    () => filterAssets(filteredAssets, workspace.activeDatasetIds, workspace.activeEnergyTypes),
    [filteredAssets, workspace.activeDatasetIds, workspace.activeEnergyTypes]
  );
  const activeDatasets = useMemo(
    () => catalog.filter((dataset) => workspace.activeDatasetIds.includes(dataset.id)),
    [catalog, workspace.activeDatasetIds]
  );
  // If the focused layer gets switched off, fall back to the first one still on.
  const focusedDataset =
    activeDatasets.find((dataset) => dataset.id === workspace.focusedDatasetId) ?? activeDatasets[0] ?? null;
  const selectedAsset = useMemo(
    () => visibleAssets.find((asset) => asset.id === workspace.selectedAssetId) ?? null,
    [visibleAssets, workspace.selectedAssetId]
  );
  const energyCounts = useMemo(() => countByEnergyType(filteredAssets), [filteredAssets]);
  const layerCounts = useMemo(() => countByDataset(filteredAssets), [filteredAssets]);
  const searchResults = useMemo(
    () =>
      buildWorkspaceSearchResults(searchQuery, {
        assets,
        countries: countryIndex,
        grades: crudeGrades.snapshot?.grades ?? [],
        operators: operatorIndex.operators
      }),
    [assets, countryIndex, crudeGrades.snapshot, operatorIndex, searchQuery]
  );

  // Hiding the selected asset (layer or energy type switched off) drops the selection.
  useEffect(() => {
    if (workspace.selectedAssetId && !selectedAsset) {
      dispatch({ type: "clearSelection" });
    }
  }, [selectedAsset, workspace.selectedAssetId]);

  // An asset picked from search, a link or the address may be outside the
  // filters; drop them rather than select something that cannot be shown.
  const selectAsset = useCallback(
    (asset: InfrastructureAsset) => {
      if (!filteredAssets.includes(asset)) {
        dispatch({ filters: NO_FILTERS, type: "setFilters" });
      }

      dispatch({ asset, type: "selectAsset" });
    },
    [filteredAssets]
  );
  const handleSelectAsset = useCallback(
    (asset: InfrastructureAsset) => {
      selectAsset(asset);
      setSearchQuery("");
      // Assets are only shown on the map and in the table; from any other
      // page, a pick (via search) goes to the map.
      setActiveView((view) => (view === "table" ? "table" : "map"));
    },
    [selectAsset]
  );
  // "Show on map" from a country or operator entry: filter to it and go to the map.
  const handleShowOnMap = useCallback((filters: Partial<AssetFilters>) => {
    dispatch({ filters: { ...NO_FILTERS, ...filters }, type: "setFilters" });
    setActiveView("map");
  }, []);
  const handleClearSelection = useCallback(() => dispatch({ type: "clearSelection" }), []);
  const handleShowAll = useCallback(() => dispatch({ type: "showAll" }), []);
  const handleFocusDataset = useCallback(
    (datasetId: DatasetId) => dispatch({ datasetId, type: "focusDataset" }),
    []
  );
  // Every cross-link into the Reference view goes through here: from an
  // asset card, between reference entries, and the Reference tabs themselves.
  const handleNavigateReference = useCallback((tab: ReferenceTab, id?: string) => {
    setReferenceLocation((current) => {
      const selectedIdByTab = { ...current.selectedIdByTab };

      if (id) {
        selectedIdByTab[tab] = id;
      } else if (tab === "glossary") {
        // Opening the glossary from its tab should not keep an old term outlined.
        delete selectedIdByTab.glossary;
      }

      return { selectedIdByTab, tab };
    });
    setActiveView("reference");
  }, []);
  const handleOpenTable = useCallback((datasetId: DatasetId) => {
    dispatch({ datasetId, type: "showDataset" });
    setActiveView("table");
  }, []);
  const handleSelectSearchResult = useCallback(
    ({ target }: SearchResult) => {
      if (target.kind === "asset") {
        handleSelectAsset(target.asset);
        return;
      }

      setSearchQuery("");
      handleNavigateReference(target.tab, target.id);
    },
    [handleNavigateReference, handleSelectAsset]
  );

  const hasAssetViews = activeView === "map" || activeView === "table";
  const selectedOperatorId = selectedAsset ? operatorIndex.operatorIdByAssetId[selectedAsset.id] : undefined;

  // The address bar follows the view and what is open in it, so a link can
  // be shared and the back button steps through where the reader has been.
  const urlState = useMemo<UrlState>(
    () => ({
      assetId: hasAssetViews ? selectedAsset?.id : undefined,
      entryId: referenceLocation.selectedIdByTab[referenceLocation.tab],
      layer: focusedDataset?.id,
      tab: referenceLocation.tab,
      view: activeView
    }),
    [activeView, focusedDataset, hasAssetViews, referenceLocation, selectedAsset]
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const pendingAssetId = pendingAssetIdRef.current;
    pendingAssetIdRef.current = null;
    const pendingAsset = pendingAssetId ? assets.find((asset) => asset.id === pendingAssetId) : undefined;

    if (pendingAsset) {
      // Selecting it re-runs this effect, which then finds the address already right.
      selectAsset(pendingAsset);
      return;
    }

    const search = buildUrlSearch(urlState);

    if (search !== buildUrlSearch(parseUrlState(window.location.search))) {
      window.history.pushState(null, "", `${window.location.pathname}${search}`);
    }
  }, [assets, isLoading, selectAsset, urlState]);

  // Back and forward: put the app where the address now says.
  useEffect(() => {
    function handlePopState() {
      const next = parseUrlState(window.location.search);
      const asset = next.assetId ? assets.find((candidate) => candidate.id === next.assetId) : undefined;

      setActiveView(next.view);

      if (next.tab) {
        setReferenceLocation((current) => toReferenceLocation(next, current));
      }

      if (next.layer) {
        dispatch({ datasetId: next.layer, type: "showDataset" });
      }

      if (asset) {
        selectAsset(asset);
      } else {
        dispatch({ type: "clearSelection" });
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [assets, selectAsset]);

  return (
    <AppShellLayout
      header={
        <TopNav
          activeView={activeView}
          onChangeView={setActiveView}
          onSearchQueryChange={setSearchQuery}
          onSelectSearchResult={handleSelectSearchResult}
          searchQuery={searchQuery}
          searchResults={searchResults}
        />
      }
      leftSidebar={
        hasAssetViews
          ? {
              content: (
                <LeftRail
                  activeDatasetIds={workspace.activeDatasetIds}
                  activeEnergyTypes={workspace.activeEnergyTypes}
                  catalog={catalog}
                  countryOptions={countryOptions}
                  energyCounts={energyCounts}
                  filters={workspace.filters}
                  layerCounts={layerCounts}
                  onChangeFilters={(filters) => dispatch({ filters, type: "setFilters" })}
                  onToggleDataset={(datasetId) => dispatch({ datasetId, type: "toggleDataset" })}
                  onToggleEnergyType={(energyType) => dispatch({ energyType, type: "toggleEnergyType" })}
                  onToggleUnmappedRoutes={() => dispatch({ type: "toggleUnmappedRoutes" })}
                  operatorOptions={operatorOptions}
                  showUnmappedRoutes={workspace.showUnmappedRoutes}
                />
              ),
              isOpen: isLeftSidebarOpen,
              label: "controls",
              onToggle: () => setIsLeftSidebarOpen((current) => !current)
            }
          : undefined
      }
      mainContent={
        <>
          {/* The map stays mounted while other views are open so its camera
              and loaded tiles survive a tab switch. */}
          <div className={activeView === "map" ? styles.mapLayer : styles.mapLayerHidden}>
            <Suspense fallback={<div className={styles.loadingState}>LOADING MAP…</div>}>
              <MapView
                basemapMode={basemapMode}
                focus={mapFocus}
                hasError={Boolean(error)}
                isLoading={isLoading}
                isVisible={activeView === "map"}
                onClearSelection={handleClearSelection}
                onSelectAsset={handleSelectAsset}
                onSelectBasemap={setBasemapMode}
                onShowAll={handleShowAll}
                selectedAssetId={selectedAsset?.id ?? null}
                showUnmappedRoutes={workspace.showUnmappedRoutes}
                visibleAssets={visibleAssets}
              />
            </Suspense>
          </div>
          {activeView === "table" ? (
            <TablePage
              activeDatasets={activeDatasets}
              focusedDataset={focusedDataset}
              onFocusDataset={handleFocusDataset}
              onSelectAsset={handleSelectAsset}
              selectedAssetId={selectedAsset?.id ?? null}
              visibleAssets={visibleAssets}
            />
          ) : null}
          {activeView === "reference" ? (
            <ReferencePage
              countries={countryIndex}
              crudeGrades={crudeGrades}
              location={referenceLocation}
              onNavigate={handleNavigateReference}
              onOpenTable={handleOpenTable}
              onSelectAsset={handleSelectAsset}
              onShowOnMap={handleShowOnMap}
              operators={operatorIndex.operators}
            />
          ) : null}
          {activeView === "about" ? <AboutPage catalog={catalog} /> : null}
        </>
      }
      rightSidebar={
        hasAssetViews && selectedAsset ? (
          <AssetCard
            asset={selectedAsset}
            onClear={handleClearSelection}
            onOpenCountry={() => handleNavigateReference("countries", selectedAsset.country)}
            onOpenOperator={
              selectedOperatorId ? () => handleNavigateReference("operators", selectedOperatorId) : undefined
            }
            onShowOnMap={activeView === "table" ? () => setActiveView("map") : undefined}
          />
        ) : undefined
      }
      statusBar={
        <StatusBar
          hasError={Boolean(error)}
          isLoading={isLoading}
          totalAssetCount={assets.length}
          visibleAssetCount={visibleAssets.length}
        />
      }
    />
  );
}

/**
 * The Reference view's position for an address. Entries open in other tabs
 * are kept; the address's own tab shows exactly what the address names.
 */
function toReferenceLocation(urlState: UrlState, current?: ReferenceLocation): ReferenceLocation {
  const tab = urlState.tab ?? "countries";
  const selectedIdByTab = { ...current?.selectedIdByTab };

  if (urlState.entryId) {
    selectedIdByTab[tab] = urlState.entryId;
  } else {
    delete selectedIdByTab[tab];
  }

  return { selectedIdByTab, tab };
}

function toggle<TValue>(values: TValue[], value: TValue) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "toggleDataset":
      return { ...state, activeDatasetIds: toggle(state.activeDatasetIds, action.datasetId) };

    case "toggleEnergyType":
      return { ...state, activeEnergyTypes: toggle(state.activeEnergyTypes, action.energyType) };

    case "toggleUnmappedRoutes":
      return { ...state, showUnmappedRoutes: !state.showUnmappedRoutes };

    case "setFilters":
      return { ...state, filters: action.filters };

    case "focusDataset":
      return { ...state, focusedDatasetId: action.datasetId };

    case "showDataset":
      // A link to "this layer in the table" must work even if the layer is off.
      return {
        ...state,
        activeDatasetIds: state.activeDatasetIds.includes(action.datasetId)
          ? state.activeDatasetIds
          : [...state.activeDatasetIds, action.datasetId],
        focusedDatasetId: action.datasetId
      };

    case "selectAsset": {
      // A search hit may belong to a layer or energy type that is switched
      // off; switch it on rather than select something that cannot be shown.
      const { asset } = action;
      const energyType = getEnergyType(asset);

      return {
        ...state,
        activeDatasetIds: state.activeDatasetIds.includes(asset.datasetId)
          ? state.activeDatasetIds
          : [...state.activeDatasetIds, asset.datasetId],
        activeEnergyTypes: state.activeEnergyTypes.includes(energyType)
          ? state.activeEnergyTypes
          : [...state.activeEnergyTypes, energyType],
        focusedDatasetId: asset.datasetId,
        selectedAssetId: asset.id
      };
    }

    case "clearSelection":
      return state.selectedAssetId === null ? state : { ...state, selectedAssetId: null };

    case "showAll":
      return {
        ...state,
        activeDatasetIds: ALL_DATASET_IDS,
        activeEnergyTypes: [...ENERGY_TYPES],
        filters: NO_FILTERS,
        showUnmappedRoutes: true
      };
  }
}
