import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { LayerSpecification } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./MapView.module.css";
import {
  POINT_DATASET_IDS,
  REFINERY_ICON_ID,
  TERMINAL_ICON_ID,
  getLabelLayerDefinition,
  getPipelineHoverFilter,
  getPipelineLayerDefinitions,
  getPointLayerDefinitions,
  getSelectionPaintUpdates,
  getUnmappedRouteUpdates
} from "./mapLayerStyles";
import { REGION_BOUNDS, getMaxBounds, type MapBounds } from "./mapRegion";
import { MARKER_ICON_PIXEL_RATIO, buildMarkerIcon } from "./markerIcons";
import type { DatasetId, InfrastructureAsset, PipelineAsset, PointAsset } from "../../types/Infrastructure";
import { ENERGY_COLORS, ENERGY_LABELS, getEnergyType } from "../../utils/assetEnergy";
import {
  getAssetDisplayName,
  getAssetTypeLabel,
  getPrimaryMetricValue,
  isOperating
} from "../../utils/infrastructure";
import { splitPipelineRoute } from "../../utils/pipelineRoute";

export type BasemapMode = "dark" | "satellite";

const BASEMAP_MODE_OPTIONS: readonly BasemapMode[] = ["dark", "satellite"];

const BASEMAP_MODE_LABELS: Record<BasemapMode, string> = {
  dark: "DARK",
  satellite: "SAT"
};

const BASEMAP_STYLE_URLS: Record<BasemapMode, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  satellite: "mapbox://styles/mapbox/satellite-v9"
};

// The one font both basemap styles can serve glyphs for. Asking for a font
// a style's glyph server lacks makes every label on that basemap fail.
const LABEL_FONT_STACK = ["Open Sans Regular"];

const DATASET_IDS: readonly DatasetId[] = ["pipelines", ...POINT_DATASET_IDS];

// Topmost first: a refinery drawn over a pipeline wins the hover / click.
const INTERACTIVE_LAYER_IDS = ["refineries-layer", "terminals-layer", "fields-layer", "pipelines-hit-layer"];

interface MapViewProps {
  basemapMode: BasemapMode;
  /**
   * What a country or operator filter narrows the map to. The camera moves
   * to frame it when `id` changes, and back to the region when it clears.
   */
  focus: { bounds: MapBounds; id: string } | null;
  hasError: boolean;
  /** True until the data files have loaded; suppresses the empty state. */
  isLoading: boolean;
  /**
   * False while another view covers the map. The map stays mounted (so the
   * camera and tiles survive a tab switch) but holds camera moves until it
   * is shown again.
   */
  isVisible: boolean;
  onClearSelection: () => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  onSelectBasemap: (mode: BasemapMode) => void;
  /** Recovery action for the empty state: switch every layer and energy type back on. */
  onShowAll: () => void;
  selectedAssetId: string | null;
  /** Whether pipeline stretches with no mapped route (the dashed joins) are drawn. */
  showUnmappedRoutes: boolean;
  visibleAssets: InfrastructureAsset[];
}

interface HoverCardState {
  subtitle: string;
  title: string;
  x: number;
  y: number;
}

export function MapView(props: MapViewProps) {
  const {
    basemapMode,
    focus,
    hasError,
    isLoading,
    isVisible,
    onSelectBasemap,
    onShowAll,
    selectedAssetId,
    showUnmappedRoutes,
    visibleAssets
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // Map event handlers and the style-load handler are bound once but must
  // always act on the current props, so they read them through this ref.
  const latestPropsRef = useRef(props);
  const hoveredAssetIdRef = useRef<string | null>(null);
  const styleModeRef = useRef<BasemapMode>(basemapMode);
  const focusedAssetIdRef = useRef<string | null>(null);
  const framedFocusIdRef = useRef<string | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    latestPropsRef.current = props;
  });

  useEffect(() => {
    if (!token || hasError || !containerRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const container = containerRef.current;
    const map = new mapboxgl.Map({
      // Opens fitted to the region, whatever size the panel is.
      bounds: REGION_BOUNDS,
      container,
      maxBounds: getMaxBounds(container.clientWidth, container.clientHeight),
      projection: "mercator",
      style: BASEMAP_STYLE_URLS[latestPropsRef.current.basemapMode]
    });

    mapRef.current = map;
    styleModeRef.current = latestPropsRef.current.basemapMode;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    // Fires on first load and again after every basemap swap, which drops
    // all custom images, sources and layers. Rebuild them from current props.
    map.on("style.load", () => {
      const latest = latestPropsRef.current;

      addAssetLayers(map, latest.visibleAssets);
      applySelection(map, latest.selectedAssetId);
      applyUnmappedRoutes(map, latest.showUnmappedRoutes);
    });

    function clearHover() {
      if (hoveredAssetIdRef.current !== null) {
        hoveredAssetIdRef.current = null;
        setPipelineHover(map, null, latestPropsRef.current.showUnmappedRoutes);
      }

      map.getCanvas().style.cursor = "";
      setHoverCard(null);
    }

    map.on("mousemove", (event) => {
      const asset = pickAsset(map, event.point, latestPropsRef.current.visibleAssets);

      if (!asset) {
        clearHover();
        return;
      }

      if (hoveredAssetIdRef.current !== asset.id) {
        hoveredAssetIdRef.current = asset.id;
        setPipelineHover(
          map,
          asset.assetKind === "pipeline" ? asset.id : null,
          latestPropsRef.current.showUnmappedRoutes
        );
      }

      map.getCanvas().style.cursor = "pointer";
      setHoverCard({
        subtitle: `${getAssetTypeLabel(asset)} · ${ENERGY_LABELS[getEnergyType(asset)].toUpperCase()}`,
        title: getAssetDisplayName(asset),
        x: event.point.x + 14,
        y: event.point.y + 14
      });
    });

    map.on("mouseout", clearHover);

    map.on("click", (event) => {
      const asset = pickAsset(map, event.point, latestPropsRef.current.visibleAssets);

      if (asset) {
        latestPropsRef.current.onSelectAsset(asset);
      } else {
        latestPropsRef.current.onClearSelection();
      }
    });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            // A hidden map has no size; resizing to zero would break its camera.
            if (container.clientWidth > 0 && container.clientHeight > 0) {
              map.resize();
              map.setMaxBounds(getMaxBounds(container.clientWidth, container.clientHeight));
            }
          });
    resizeObserver?.observe(container);

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      hoveredAssetIdRef.current = null;
      focusedAssetIdRef.current = null;
      setHoverCard(null);
    };
  }, [token, hasError]);

  useEffect(() => {
    const map = mapRef.current;

    if (map && hasAssetLayers(map)) {
      setAssetSourceData(map, visibleAssets);
    }
  }, [visibleAssets]);

  useEffect(() => {
    const map = mapRef.current;

    if (map && hasAssetLayers(map)) {
      applySelection(map, selectedAssetId);
    }
  }, [selectedAssetId]);

  useEffect(() => {
    const map = mapRef.current;

    if (map && hasAssetLayers(map)) {
      applyUnmappedRoutes(map, showUnmappedRoutes);
    }
  }, [showUnmappedRoutes]);

  // Frame what a filter narrows to. Declared before the selection's camera
  // move so that, when both change at once, the selected asset wins.
  useEffect(() => {
    const map = mapRef.current;
    const focusId = focus?.id ?? null;

    if (!map || !isVisible || framedFocusIdRef.current === focusId) {
      return;
    }

    framedFocusIdRef.current = focusId;
    // A map that was hidden has not measured its panel yet; fitting before
    // it does frames the wrong area.
    map.resize();
    map.fitBounds(focus ? focus.bounds : REGION_BOUNDS, { duration: 800, maxZoom: 8, padding: 60 });
  }, [focus, isVisible]);

  // Move the camera to a newly selected asset. Runs again when the map is
  // revealed so a selection made in another view is in frame on return.
  // Reads the asset list through the ref so filter changes don't re-trigger it.
  useEffect(() => {
    const map = mapRef.current;

    if (!selectedAssetId) {
      focusedAssetIdRef.current = null;
      return;
    }

    if (!map || !isVisible || focusedAssetIdRef.current === selectedAssetId) {
      return;
    }

    const asset = latestPropsRef.current.visibleAssets.find((item) => item.id === selectedAssetId);

    if (!asset) {
      return;
    }

    focusedAssetIdRef.current = selectedAssetId;

    if (asset.assetKind === "pipeline") {
      map.resize();
      map.fitBounds(getPipelineBounds(asset), { duration: 1200, maxZoom: 9, padding: 80 });
      return;
    }

    map.flyTo({
      center: [asset.lon, asset.lat],
      duration: 1200,
      zoom: Math.max(map.getZoom(), 6.5)
    });
  }, [selectedAssetId, isVisible]);

  useEffect(() => {
    const map = mapRef.current;

    // Skip when the map is already on this basemap (true on first render):
    // re-setting a style that is still loading makes Mapbox rebuild it.
    if (map && styleModeRef.current !== basemapMode) {
      styleModeRef.current = basemapMode;
      map.setStyle(BASEMAP_STYLE_URLS[basemapMode]);
    }
  }, [basemapMode]);

  if (hasError) {
    return <div className={styles.emptyState}>MAP DATA UNAVAILABLE</div>;
  }

  if (!token) {
    return (
      <div className={styles.emptyState}>
        MAPBOX TOKEN REQUIRED. ADD `VITE_MAPBOX_ACCESS_TOKEN` TO `.env.local` TO ENABLE THE MAP.
      </div>
    );
  }

  return (
    <section className={styles.mapShell}>
      <div className={styles.mapToolbar}>
        <button
          className={styles.toolbarButton}
          onClick={() => mapRef.current?.fitBounds(REGION_BOUNDS, { duration: 800 })}
          type="button"
        >
          RESET VIEW
        </button>
        <div aria-label="Basemap" className={styles.basemapGroup} role="group">
          {BASEMAP_MODE_OPTIONS.map((mode) => (
            <button
              aria-pressed={mode === basemapMode}
              className={mode === basemapMode ? styles.basemapSegmentActive : styles.basemapSegment}
              key={mode}
              onClick={() => onSelectBasemap(mode)}
              type="button"
            >
              {BASEMAP_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.mapViewport} ref={containerRef} />
      {!isLoading && visibleAssets.length === 0 ? (
        <div className={styles.noAssets} role="status">
          <div className={styles.noAssetsTitle}>NO ASSETS VISIBLE</div>
          <p className={styles.noAssetsBody}>
            Every layer or every energy type is switched off. Turn one back on in the left rail, or show everything.
          </p>
          <button className={styles.noAssetsButton} onClick={onShowAll} type="button">
            SHOW ALL
          </button>
        </div>
      ) : null}
      {hoverCard ? (
        <div className={styles.hoverCard} style={{ left: hoverCard.x, top: hoverCard.y }}>
          <div className={styles.hoverTitle}>{hoverCard.title}</div>
          <div className={styles.hoverSubtitle}>{hoverCard.subtitle}</div>
        </div>
      ) : null}
    </section>
  );
}

function hasAssetLayers(map: mapboxgl.Map) {
  return Boolean(map.getSource("refineries"));
}

function addAssetLayers(map: mapboxgl.Map, assets: InfrastructureAsset[]) {
  if (hasAssetLayers(map)) {
    return;
  }

  // Refineries are all crude oil and LNG terminals all gas, so each marker
  // shape needs only one colour.
  map.addImage(REFINERY_ICON_ID, buildMarkerIcon("diamond", ENERGY_COLORS.oil), {
    pixelRatio: MARKER_ICON_PIXEL_RATIO
  });
  map.addImage(TERMINAL_ICON_ID, buildMarkerIcon("triangle", ENERGY_COLORS.gas), {
    pixelRatio: MARKER_ICON_PIXEL_RATIO
  });

  DATASET_IDS.forEach((datasetId) => {
    map.addSource(datasetId, { data: buildFeatureCollection(assets, datasetId), type: "geojson" });
  });

  // Order is draw order: pipelines at the bottom, then fields, terminals,
  // refineries, with labels above everything.
  const layers = [
    ...getPipelineLayerDefinitions(),
    ...POINT_DATASET_IDS.flatMap((datasetId) => getPointLayerDefinitions(datasetId)),
    ...POINT_DATASET_IDS.map((datasetId) => getLabelLayerDefinition(datasetId, LABEL_FONT_STACK))
  ];

  layers.forEach((layer) => map.addLayer(layer as LayerSpecification));
}

function setAssetSourceData(map: mapboxgl.Map, assets: InfrastructureAsset[]) {
  DATASET_IDS.forEach((datasetId) => {
    const source = map.getSource(datasetId) as mapboxgl.GeoJSONSource | undefined;

    source?.setData(buildFeatureCollection(assets, datasetId));
  });
}

function applySelection(map: mapboxgl.Map, selectedAssetId: string | null) {
  const selectionFilter = ["==", ["get", "id"], selectedAssetId ?? ""];

  DATASET_IDS.forEach((datasetId) => {
    map.setFilter(`${datasetId}-selected-layer`, selectionFilter);
  });

  getSelectionPaintUpdates(selectedAssetId).forEach(({ layerId, property, value }) => {
    // Mapbox types each paint property against its own layer type; the
    // style definitions here are built as plain data, so widen at the edge.
    map.setPaintProperty(layerId, property as never, value as never);
  });
}

function applyUnmappedRoutes(map: mapboxgl.Map, showUnmappedRoutes: boolean) {
  const { filters, layout } = getUnmappedRouteUpdates(showUnmappedRoutes);

  layout.forEach(({ layerId, property, value }) => map.setLayoutProperty(layerId, property as never, value as never));
  filters.forEach(({ filter, layerId }) => map.setFilter(layerId, filter as never));
}

function setPipelineHover(map: mapboxgl.Map, pipelineId: string | null, showUnmappedRoutes: boolean) {
  if (map.getLayer("pipelines-hover-layer")) {
    map.setFilter("pipelines-hover-layer", getPipelineHoverFilter(pipelineId, showUnmappedRoutes) as never);
  }
}

function pickAsset(map: mapboxgl.Map, point: mapboxgl.Point, assets: InfrastructureAsset[]) {
  if (!hasAssetLayers(map)) {
    return null;
  }

  const [feature] = map.queryRenderedFeatures(point, { layers: INTERACTIVE_LAYER_IDS });
  const assetId = feature?.properties?.id;

  return assetId ? assets.find((asset) => asset.id === assetId) ?? null : null;
}

function buildFeatureCollection(assets: InfrastructureAsset[], datasetId: DatasetId): FeatureCollection {
  return {
    features: assets
      .filter((asset) => asset.datasetId === datasetId)
      .flatMap((asset) => (asset.assetKind === "pipeline" ? buildPipelineFeatures(asset) : buildPointFeature(asset))),
    type: "FeatureCollection"
  };
}

// A pipeline becomes up to two features sharing its id: the stretches that
// follow its route, and the long straight joins that do not (drawn dashed).
function buildPipelineFeatures(asset: PipelineAsset): FeatureCollection["features"] {
  const { mapped, unmapped } = splitPipelineRoute(asset.geometry);
  const properties = {
    energy: getEnergyType(asset),
    id: asset.id,
    isOperating: isOperating(asset),
    name: asset.name
  };

  return [
    { isRouteMapped: true, lines: mapped },
    { isRouteMapped: false, lines: unmapped }
  ]
    .filter(({ lines }) => lines.length > 0)
    .map(({ isRouteMapped, lines }) => ({
      geometry: { coordinates: lines, type: "MultiLineString" },
      properties: { ...properties, isRouteMapped },
      type: "Feature"
    }));
}

function buildPointFeature(asset: PointAsset): FeatureCollection["features"][number] {
  return {
    geometry: { coordinates: [asset.lon, asset.lat], type: "Point" },
    properties: {
      energy: getEnergyType(asset),
      id: asset.id,
      isOperating: isOperating(asset),
      name: asset.name,
      sizeValue: getPrimaryMetricValue(asset),
      terminalRole: asset.assetKind === "terminal" ? asset.terminalRole : undefined
    },
    type: "Feature"
  };
}

function getPipelineBounds(asset: PipelineAsset) {
  const bounds = new mapboxgl.LngLatBounds();
  const segments = asset.geometry.type === "LineString" ? [asset.geometry.coordinates] : asset.geometry.coordinates;

  segments.forEach((segment) => segment.forEach((coordinate) => bounds.extend(coordinate)));
  return bounds;
}
