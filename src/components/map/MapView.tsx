import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { AnyLayer } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./MapView.module.css";
import { TERMINAL_DARK_STYLE_URL } from "./darkBasemapTheme";
import { getChokepointLayerDefinitions, getPipelineLayerDefinitions } from "./mapLayerStyles";
import { createLineSourceDefinition, createPointSourceDefinition, type GeoJsonPayload } from "./mapSourceDefinitions";
import type { DatasetId, InfrastructureAsset } from "../../types/Infrastructure";
import type { OutageEvent } from "../../types/outageEvent";
import type { FirmsSnapshot } from "../../types/firms";
import type {
  ColorByOption,
  MapDisplaySettings,
  SizeByOption
} from "../../types/mapDisplaySettings";
import type { BypassModelResult } from "../../utils/bypassModel";
import { RegionalSnapshotOverlay } from "./RegionalSnapshotOverlay";
import { getAssetTypeLabel } from "../../utils/infrastructure";
import {
  FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD,
  FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD,
  HORMUZ_CHOKEPOINT_ID,
  IDLE_SCENARIO_VISUAL_STATE,
  SAUDI_EAST_WEST_PIPELINE_ID,
  UAE_ADCOP_PIPELINE_ID,
  computeBypassGlowColor,
  computeBypassGlowOpacity,
  computeBypassGlowWidthBonus,
  computeFeedstockRiskOpacity,
  computeHormuzHazardColor,
  computeHormuzHazardOpacity,
  computeHormuzHazardWidth,
  isFeedstockRiskActive,
  type ScenarioVisualState
} from "../../utils/scenarioMapStyles";

// Basemap mode drives both the underlying Mapbox style URL AND the
// foreground layer treatment. "dark" / "satellite" show full asset +
// FIRMS overlays. "firms" dims the asset layers to background and
// amplifies FIRMS detections so the map reads like the NASA FIRMS
// website — a satellite field dominated by red fire hotspots.
export type BasemapMode = "dark" | "satellite" | "firms";

interface MapViewProps {
  activeDatasetIds: DatasetId[];
  hasError: boolean;
  basemapMode: BasemapMode;
  onClearSelection: () => void;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  onSelectBasemap: (mode: BasemapMode) => void;
  /**
   * Curated outage events. When present, events with a resolvable
   * refinery `assetId` (from the last 365 days) render as severity-
   * coloured circles anchored to the refinery's coordinates. No prop
   * means "no outage layer" — the map behaves identically to before.
   * NOTE: a LayerControlsPanel toggle is a follow-up; for now the
   * layer is always visible when events are supplied.
   */
  outageEvents?: OutageEvent[] | null;
  /**
   * FIRMS (NASA satellite thermal anomaly) snapshot. When supplied,
   * geofence-matched detections render in three severity-tiered
   * layers: NORMAL (dim grey dot), ELEVATED (yellow), ALERT (red
   * with a pulsing halo). Null means "FIRMS layer off".
   */
  firmsSnapshot?: FirmsSnapshot | null;
  scenarioState?: ScenarioVisualState;
  selectedAssetId: string | null;
  visibleAssets: InfrastructureAsset[];
  mapDisplaySettings?: MapDisplaySettings;
  /**
   * Regional-snapshot overlay tile rendered in the map's top-right
   * gutter. When supplied, shows Hormuz flow, scenario disruption,
   * net deficit, days-to-OECD-min, refinery count, and FIRMS alerts.
   * Omit to hide the tile entirely.
   */
  regionalSnapshot?: {
    bypassResult: BypassModelResult | null;
    disruptionPct: number;
    hormuzBaselineMbpd: number;
    firmsAlertCount: number;
  };
}

const ASSET_INTERACTIVE_LAYER_IDS = [
  "refineries-layer",
  "fields-layer",
  "terminals-layer",
  "pipelines-hit-layer",
  "chokepoints-hit-layer"
] as const;

const MAP_INTERACTIVE_LAYER_IDS = [...ASSET_INTERACTIVE_LAYER_IDS] as const;

interface HoverCardState {
  accent: string;
  assetId?: string | null;
  subtitle: string;
  title: string;
  x: number;
  y: number;
}

const DEFAULT_CENTER: [number, number] = [50.4, 25.6];
const DEFAULT_ZOOM = 4.8;
const SATELLITE_STYLE_URL = "mapbox://styles/mapbox/satellite-v9";

export function MapView({
  activeDatasetIds,
  hasError,
  basemapMode,
  onClearSelection,
  onSelectAsset,
  onSelectBasemap,
  outageEvents = null,
  firmsSnapshot = null,
  scenarioState = IDLE_SCENARIO_VISUAL_STATE,
  selectedAssetId,
  visibleAssets,
  mapDisplaySettings,
  regionalSnapshot
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const assetsRef = useRef<InfrastructureAsset[]>(visibleAssets);
  const outageEventsRef = useRef<OutageEvent[] | null>(outageEvents);
  const firmsSnapshotRef = useRef<FirmsSnapshot | null>(firmsSnapshot);
  const basemapModeRef = useRef<BasemapMode>(basemapMode);
  const mapDisplaySettingsRef = useRef<MapDisplaySettings | undefined>(mapDisplaySettings);
  const selectRef = useRef(onSelectAsset);
  const selectedAssetIdRef = useRef<string | null>(selectedAssetId);
  const scenarioStateRef = useRef<ScenarioVisualState>(scenarioState);
  // Tracks whether `bindInteraction` has been wired yet. Needed because
  // we now bind from the `style.load` event (rather than `load`), and
  // `style.load` fires on every basemap swap (dark → satellite → …).
  // Binding twice on the same `Map` instance doubles every click /
  // hover handler, so the ref makes the first call authoritative and
  // the swap-triggered calls a no-op.
  const hasBoundInteractionRef = useRef(false);
  const hoveredAssetIdRef = useRef<string | null>(null);
  const currentStyleRef = useRef(getBasemapStyleUrl(basemapMode));
  const pendingCameraRef = useRef<{
    bearing: number;
    center: ReturnType<mapboxgl.Map["getCenter"]>;
    pitch: number;
    zoom: number;
  } | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const basemapStyleUrl = getBasemapStyleUrl(basemapMode);
  const assetCounts = useMemo(() => {
    return {
      chokepoints: visibleAssets.filter((asset) => asset.assetKind === "chokepoint").length,
      fields: visibleAssets.filter((asset) => asset.assetKind === "field").length,
      pipelines: visibleAssets.filter((asset) => asset.assetKind === "pipeline").length,
      refineries: visibleAssets.filter((asset) => asset.assetKind === "refinery").length,
      terminals: visibleAssets.filter((asset) => asset.assetKind === "terminal").length
    };
  }, [visibleAssets]);

  useEffect(() => {
    assetsRef.current = visibleAssets;
  }, [visibleAssets]);

  useEffect(() => {
    outageEventsRef.current = outageEvents;
  }, [outageEvents]);

  useEffect(() => {
    firmsSnapshotRef.current = firmsSnapshot;
  }, [firmsSnapshot]);

  useEffect(() => {
    basemapModeRef.current = basemapMode;
    // When basemap mode flips *without* a style URL change (e.g.
    // satellite → firms, which share the same style URL), the
    // `style.load` handler doesn't refire, so we need to re-apply the
    // dim/amplify treatment manually. The style-URL swap path
    // (dark ↔ satellite) goes through style.load and runs the same
    // helper there.
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      applyBasemapModeStyling(map, basemapMode);
    }
  }, [basemapMode]);

  useEffect(() => {
    mapDisplaySettingsRef.current = mapDisplaySettings;
  }, [mapDisplaySettings]);

  useEffect(() => {
    selectRef.current = onSelectAsset;
  }, [onSelectAsset]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      bearing: 0,
      center: DEFAULT_CENTER,
      container: containerRef.current,
      pitch: 0,
      projection: "mercator",
      style: currentStyleRef.current,
      zoom: DEFAULT_ZOOM
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    map.on("style.load", () => {
      syncMapStyle(
        map,
        assetsRef.current,
        selectedAssetIdRef.current,
        hoveredAssetIdRef.current,
        outageEventsRef.current,
        firmsSnapshotRef.current
      );

      applyBasemapModeStyling(map, basemapModeRef.current);
      applyMapDisplaySettings(
        map,
        mapDisplaySettingsRef.current,
        basemapModeRef.current
      );

      if (pendingCameraRef.current) {
        map.jumpTo(pendingCameraRef.current);
        pendingCameraRef.current = null;
      }

      // Wire click / hover handlers from `style.load` rather than the
      // top-level `load` event. Reason: `load` gates on `map.loaded()
      // === true`, and the FIRMS alert-halo rAF pulse mutates paint
      // every frame via `setPaintProperty`, which leaves `_styleDirty`
      // perpetually true → `loaded()` never becomes true → `load` never
      // fires → click binding never runs. `style.load` is the right
      // boundary: it fires as soon as sources + layers are ready, which
      // is all `bindInteraction` needs. Guarded by a ref so basemap
      // swaps don't double-bind.
      if (!hasBoundInteractionRef.current) {
        bindInteraction(map);
        hasBoundInteractionRef.current = true;
      }
    });

    return () => {
      setHoverCard(null);
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;

    if (!container || !map || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || currentStyleRef.current === basemapStyleUrl) {
      return;
    }

    pendingCameraRef.current = {
      bearing: map.getBearing(),
      center: map.getCenter(),
      pitch: map.getPitch(),
      zoom: map.getZoom()
    };
    currentStyleRef.current = basemapStyleUrl;
    setHoverCard(null);
    setHoveredAssetId(null);
    hoveredAssetIdRef.current = null;
    map.setStyle(basemapStyleUrl);
  }, [basemapStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    selectedAssetIdRef.current = selectedAssetId;

    if (!map) {
      return;
    }

    // Defensive race fix: if the style isn't loaded yet OR the
    // expected sources haven't been added yet (syncMapStyle is
    // responsible for creating them inside the `style.load` handler),
    // queue this sync to run once style.load fires. Without this
    // queueing, the first load's data arrival can race with the
    // initial style.load in two ways:
    //   a) sync effect fires first, bails on `!isStyleLoaded()`,
    //      never re-runs → sources stay empty → map is "bare"
    //   b) style.load fires first with stale empty `assetsRef.current`
    //      → sources seeded empty → sync effect fires next but finds
    //      no source (because ensurePointSource already ran with []
    //      data) and setSourceData silently succeeds — except that
    //      the original paint didn't kick visually until a second
    //      style swap forced a reflow.
    // The `map.once("style.load", runSync)` fallback handles case (a),
    // and because runSync reads the LATEST visibleAssets from the
    // closure at call time, it also fixes case (b) when style.load
    // arrives after data.
    const runSync = () => {
      setSourceData(map, "refineries", buildPointCollection(visibleAssets, "refinery"));
      setSourceData(map, "fields", buildPointCollection(visibleAssets, "field"));
      setSourceData(map, "terminals", buildPointCollection(visibleAssets, "terminal"));
      setSourceData(map, "pipelines", buildLineCollection(visibleAssets, "pipeline"));
      setSourceData(map, "chokepoints", buildLineCollection(visibleAssets, "chokepoint"));
      setSourceData(
        map,
        "outage-events",
        buildOutageEventCollection(outageEvents, visibleAssets)
      );
      setSourceData(
        map,
        "firms-detections",
        buildFirmsDetectionCollection(firmsSnapshot)
      );
      syncSelectedAsset(map, selectedAssetId);
      syncHoveredAsset(map, hoveredAssetId);
      syncScenarioLayers(map, scenarioStateRef.current);
    };

    if (map.isStyleLoaded() && map.getSource("refineries")) {
      runSync();
    } else {
      map.once("style.load", runSync);
    }

    return () => {
      // If this effect re-runs before `style.load` fires, clean up the
      // pending listener so we don't end up with multiple queued syncs
      // all racing against each other.
      map.off("style.load", runSync);
    };
  }, [selectedAssetId, visibleAssets, outageEvents, firmsSnapshot, hoveredAssetId]);

  // FIRMS ALERT halo pulse. A dedicated rAF loop runs only when the
  // (FIRMS alert-halo rAF pulse loop deleted. The halo layer itself is
  // also removed from the style — it was rendering a big pulsing red
  // ring around any ALERT-severity FIRMS detection, which read as
  // cluttered and "unserious" on top of everything else. The FIRMS
  // severity tier is now conveyed purely via the fill color + radius
  // of the three dot layers (grey / yellow / red) that still exist.)

  // Scenario visual state: push paint-property updates whenever the bypass
  // model transitions. This is the *static* part of the visual override —
  // base colors, widths, and filters. Animated pulsing / dash-offset flow
  // lives in the separate scenario rAF loop below.
  useEffect(() => {
    const map = mapRef.current;
    scenarioStateRef.current = scenarioState;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    syncScenarioLayers(map, scenarioState);
  }, [scenarioState]);

  // Scenario animation loop. Runs whenever the scenario is active and drives:
  //   - Hormuz hazard overlay breathing pulse (scales base opacity).
  //   - Bypass-glow dash offset (creates the "flowing crude" effect along
  //     Petroline and ADCOP).
  //   - Feedstock-risk refinery outline breathing pulse (only above the
  //     50% disruption threshold).
  // Fully torn down when scenario is released so a stale rAF never ticks.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !scenarioState.isScenarioActive) {
      return;
    }

    let rafId: number | null = null;
    let lastFrameMs = 0;
    const startMs = performance.now();

    function scenarioFrame(now: number) {
      if (!map) {
        return;
      }

      if (now - lastFrameMs < PULSE_FRAME_INTERVAL_MS) {
        rafId = window.requestAnimationFrame(scenarioFrame);
        return;
      }
      lastFrameMs = now;

      const elapsed = now - startMs;
      const phase = (elapsed % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      // Sine wave in [0, 1]. Smooth breathing tuned to feel "alive" without
      // being distracting at the map's default zoom.
      const wave = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);

      const state = scenarioStateRef.current;
      const baseHazardOpacity = computeHormuzHazardOpacity(state.disruptionPct);
      if (baseHazardOpacity > 0 && map.getLayer("chokepoints-hazard-layer")) {
        // Modulate ±18% around base opacity so the hazard "throbs" in time
        // with the refinery warning outlines.
        const modulated = baseHazardOpacity * (0.82 + wave * 0.36);
        map.setPaintProperty("chokepoints-hazard-layer", "line-opacity", modulated);
      }

      if (isFeedstockRiskActive(state.disruptionPct)) {
        const baseRiskOpacity = computeFeedstockRiskOpacity(state.disruptionPct);
        if (map.getLayer("refineries-feedstock-risk-layer")) {
          const modulated = baseRiskOpacity * (0.7 + wave * 0.5);
          map.setPaintProperty(
            "refineries-feedstock-risk-layer",
            "circle-stroke-opacity",
            modulated
          );
          // Breathe the ring slightly wider on the upstroke.
          map.setPaintProperty(
            "refineries-feedstock-risk-layer",
            "circle-stroke-width",
            3 + wave * 2.5
          );
        }
      }

      // Mapbox doesn't animate `line-dasharray` natively, so we rotate
      // through a small set of preset tuples to fake a "flowing arrow"
      // effect. Cheap — one paint write per bypass layer per frame.
      const presetIndex = Math.floor(elapsed / 140) % BYPASS_DASH_PRESETS.length;
      const preset = BYPASS_DASH_PRESETS[presetIndex];
      BYPASS_PIPELINE_LAYER_IDS.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-dasharray", preset);
        }
      });

      rafId = window.requestAnimationFrame(scenarioFrame);
    }

    rafId = window.requestAnimationFrame(scenarioFrame);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [scenarioState.isScenarioActive]);

  useEffect(() => {
    const map = mapRef.current;
    hoveredAssetIdRef.current = hoveredAssetId;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    syncHoveredAsset(map, hoveredAssetId);
  }, [hoveredAssetId]);

  // (Previous selection-pulse rAF loop deleted — selection is now a
  // single static amber outline, so there's nothing to animate.)

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !selectedAssetId) {
      return;
    }

    const selectedAsset = assetsRef.current.find((asset) => asset.id === selectedAssetId);

    if (!selectedAsset) {
      return;
    }

    if (selectedAsset.assetKind === "refinery" || selectedAsset.assetKind === "field" || selectedAsset.assetKind === "terminal") {
      map.flyTo({
        center: [selectedAsset.lon, selectedAsset.lat],
        duration: 1200,
        essential: true,
        zoom: Math.max(map.getZoom(), 6.5)
      });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();

    extendBoundsForLineGeometry(bounds, selectedAsset.geometry);

    map.fitBounds(bounds, {
      duration: 1200,
      essential: true,
      padding: 80
    });
  }, [selectedAssetId]);

  // Map display settings: point size, size-by, color-by, labels.
  // Uses setPaintProperty / setLayoutProperty for live updates without
  // re-adding layers. Label layers are created lazily on first toggle.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    applyMapDisplaySettings(map, mapDisplaySettings, basemapMode);
  }, [basemapMode, mapDisplaySettings]);

  if (hasError) {
    return <div className={styles.emptyState}>MAP DATA UNAVAILABLE</div>;
  }

  if (!token) {
    return (
      <div className={styles.emptyState}>
        MAPBOX TOKEN REQUIRED. ADD `VITE_MAPBOX_ACCESS_TOKEN` TO ENABLE MAP VIEW.
      </div>
    );
  }

  return (
    <section className={styles.mapShell}>
      <div className={styles.mapToolbar}>
        <div className={styles.summaryPill}>DATASETS {activeDatasetIds.length}</div>
        <div className={styles.summaryPill}>REF {assetCounts.refineries}</div>
        <div className={styles.summaryPill}>FLD {assetCounts.fields}</div>
        <div className={styles.summaryPill}>LNG {assetCounts.terminals}</div>
        <div className={styles.summaryPill}>PIPE {assetCounts.pipelines}</div>
        <div className={styles.summaryPill}>CP {assetCounts.chokepoints}</div>
        <div className={styles.basemapGroup} role="group" aria-label="Basemap mode">
          {BASEMAP_MODE_OPTIONS.map((mode) => {
            const isActive = mode === basemapMode;
            return (
              <button
                aria-pressed={isActive}
                className={[
                  styles.basemapSegment,
                  isActive ? styles.basemapSegmentActive : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={mode}
                onClick={() => onSelectBasemap(mode)}
                title={`Basemap: ${BASEMAP_MODE_LABELS[mode]}`}
                type="button"
              >
                {BASEMAP_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={styles.mapViewport}
        ref={containerRef}
      />
      {regionalSnapshot ? (
        <RegionalSnapshotOverlay
          bypassResult={regionalSnapshot.bypassResult}
          disruptionPct={regionalSnapshot.disruptionPct}
          firmsAlertCount={regionalSnapshot.firmsAlertCount}
          hormuzBaselineMbpd={regionalSnapshot.hormuzBaselineMbpd}
          refineryCount={assetCounts.refineries}
        />
      ) : null}
      {hoverCard ? (
        <div
          className={styles.hoverCard}
          style={{
            left: hoverCard.x,
            top: hoverCard.y
          }}
        >
          <div
            className={styles.hoverAccent}
            style={{ backgroundColor: hoverCard.accent }}
          />
          <div className={styles.hoverCardBody}>
            <div className={styles.hoverTitle}>{hoverCard.title}</div>
            <div className={styles.hoverSubtitle}>{hoverCard.subtitle}</div>
          </div>
        </div>
      ) : null}
    </section>
  );

  function bindInteraction(map: mapboxgl.Map) {
    ASSET_INTERACTIVE_LAYER_IDS.forEach((layerId) => {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mousemove", layerId, (event) => {
        const hoveredId = event.features?.[0]?.properties?.id;
        const asset = assetsRef.current.find((item) => item.id === hoveredId);

        if (asset) {
          setHoverCard({
            accent: asset.assetKind === "pipeline" ? "#FF8C00" : asset.assetKind === "chokepoint" ? "#FF1744" : "#FF8C00",
            assetId: asset.id,
            subtitle: getAssetTypeLabel(asset),
            title: asset.name,
            x: event.point.x + 14,
            y: event.point.y + 14
          });
          setHoveredAssetId(asset.id);
        }
      });

      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
        setHoverCard(null);
        setHoveredAssetId(null);
      });

      map.on("click", layerId, (event) => {
        const clickedId = event.features?.[0]?.properties?.id;
        const asset = assetsRef.current.find((item) => item.id === clickedId);

        if (asset) {
          selectRef.current(asset);
        }
      });
    });

    map.on("click", (event) => {
      const renderedFeatures = map.queryRenderedFeatures(event.point, {
        layers: [...MAP_INTERACTIVE_LAYER_IDS]
      });

      if (renderedFeatures.length === 0) {
        syncSelectedAsset(map, null);
        setHoverCard(null);
        setHoveredAssetId(null);
        onClearSelection();
      }
    });
  }
}

function addRefineryLayers(map: mapboxgl.Map) {
  if (map.getLayer("refineries-layer")) {
    return;
  }

  map.addLayer({
    id: "refineries-layer",
    paint: {
      "circle-color": [
        "match",
        ["get", "status"],
        "operational",
        "#00C853",
        "planned_startup",
        "#FF8C00",
        "planned_maintenance",
        "#FFD600",
        "unplanned_incident",
        "#FF1744",
        "construction",
        "#2196F3",
        "unknown",
        "#666666",
        "#555555"
      ],
      "circle-opacity": 0.9,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["sqrt", ["/", ["coalesce", ["get", "capacity_bpd"], 0], 10000]],
        0,
        4,
        12,
        15
      ],
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 1
    },
    source: "refineries",
    type: "circle"
  });

  // Single thin amber outline marking the selected refinery. The
  // previous two-layer halo+pulse was visually busy and read as a
  // targeting reticle — we now keep selection quiet and let the
  // spotlight dimming alone do the "this is the active one" work.
  map.addLayer({
    id: "refineries-selected-layer",
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["sqrt", ["/", ["coalesce", ["get", "capacity_bpd"], 0], 10000]],
        0,
        10,
        12,
        22
      ],
      "circle-stroke-color": "#FF8C00",
      "circle-stroke-opacity": 0.9,
      "circle-stroke-width": 2
    },
    source: "refineries",
    type: "circle"
  });
}

function addFieldLayers(map: mapboxgl.Map) {
  if (map.getLayer("fields-layer")) {
    return;
  }

  map.addLayer({
    id: "fields-layer",
    paint: {
      "circle-color": [
        "match",
        ["get", "fieldType"],
        "oil",
        "#FF8C00",
        "gas",
        "#64B5F6",
        "mixed",
        "#E0E0E0",
        "condensate",
        "#FFCC80",
        "#999999"
      ],
      "circle-opacity": 0.85,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "production_bpd"], 0],
        0,
        3,
        250000,
        6,
        1000000,
        9
      ],
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 1
    },
    source: "fields",
    type: "circle"
  });

  map.addLayer({
    id: "fields-selected-layer",
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "production_bpd"], 0],
        0,
        8,
        250000,
        11,
        1000000,
        14
      ],
      "circle-stroke-color": "#FF8C00",
      "circle-stroke-opacity": 0.9,
      "circle-stroke-width": 2
    },
    source: "fields",
    type: "circle"
  });
}

function addTerminalLayers(map: mapboxgl.Map) {
  if (map.getLayer("terminals-layer")) {
    return;
  }

  map.addLayer({
    id: "terminals-layer",
    paint: {
      "circle-color": [
        "match",
        ["get", "terminalRole"],
        "export",
        "#FF8C00",
        "import",
        "#64B5F6",
        "#E0E0E0"
      ],
      "circle-opacity": 0.9,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "capacity_mtpa"], 0],
        0,
        4,
        5,
        6,
        20,
        10,
        50,
        13
      ],
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 1
    },
    source: "terminals",
    type: "circle"
  });

  map.addLayer({
    id: "terminals-selected-layer",
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "capacity_mtpa"], 0],
        0,
        10,
        5,
        12,
        20,
        16,
        50,
        19
      ],
      "circle-stroke-color": "#FF8C00",
      "circle-stroke-opacity": 0.9,
      "circle-stroke-width": 2
    },
    source: "terminals",
    type: "circle"
  });
}

function addPipelineLayers(map: mapboxgl.Map) {
  if (map.getLayer("pipelines-layer")) {
    return;
  }

  getPipelineLayerDefinitions("pipelines").forEach((layer) => {
    map.addLayer(layer as AnyLayer);
  });
}

function addChokepointLayers(map: mapboxgl.Map) {
  if (map.getLayer("chokepoints-layer")) {
    return;
  }

  getChokepointLayerDefinitions("chokepoints").forEach((layer) => {
    map.addLayer(layer as AnyLayer);
  });

  map.addLayer({
    id: "chokepoints-labels",
    layout: {
      "symbol-placement": "line-center",
      "text-field": ["get", "name"],
      "text-font": ["Open Sans Regular"],
      "text-size": 10,
      "text-transform": "uppercase"
    },
    paint: {
      "text-color": "#FFD600",
      "text-halo-color": "#000000",
      "text-halo-width": 1
    },
    source: "chokepoints",
    type: "symbol"
  });
}

// ---------------------------------------------------------------------------
// Scenario visual override layers
// ---------------------------------------------------------------------------
//
// Three layers that only render when the bypass modeler is engaged. They sit
// ON TOP of their base counterparts (chokepoints / pipelines / refineries)
// and are controlled entirely by setPaintProperty / setFilter calls from
// syncScenarioLayers and the scenario rAF loop. The layers themselves are
// always installed at map-style-load time with zero opacity; visibility is
// gated by paint state rather than `visibility: none` so we can animate the
// fade in smoothly on scenario engage.

function addHormuzHazardLayer(map: mapboxgl.Map) {
  if (map.getLayer("chokepoints-hazard-layer")) {
    return;
  }

  map.addLayer({
    filter: ["==", ["get", "id"], HORMUZ_CHOKEPOINT_ID],
    id: "chokepoints-hazard-layer",
    layout: {
      "line-cap": "butt",
      "line-join": "round"
    },
    paint: {
      "line-blur": 4,
      "line-color": "#FF8C00",
      "line-opacity": 0,
      "line-width": 0
    },
    source: "chokepoints",
    type: "line"
  });
}

function addBypassGlowLayer(map: mapboxgl.Map) {
  if (map.getLayer("pipelines-bypass-glow-layer")) {
    return;
  }

  map.addLayer({
    filter: [
      "in",
      ["get", "id"],
      ["literal", [SAUDI_EAST_WEST_PIPELINE_ID, UAE_ADCOP_PIPELINE_ID]]
    ],
    id: "pipelines-bypass-glow-layer",
    layout: {
      "line-cap": "round",
      "line-join": "round"
    },
    paint: {
      "line-blur": 1.2,
      "line-color": "#FF8C00",
      "line-dasharray": [4, 2],
      "line-opacity": 0,
      "line-width": 0
    },
    source: "pipelines",
    type: "line"
  });
}

// Outage events layer. Rendered as severity-coloured circles anchored
// to the linked refinery asset's coordinates. Feature properties carry
// `severity` ("LOW" | "MEDIUM" | "HIGH" | "CRITICAL") which drives a
// match-expression paint rule. LayerControlsPanel toggle is a
// follow-up — today the layer renders whenever outage data is supplied.
function addOutageEventLayer(map: mapboxgl.Map) {
  if (map.getLayer("outage-events-layer")) {
    return;
  }

  map.addLayer({
    id: "outage-events-layer",
    source: "outage-events",
    type: "circle",
    paint: {
      "circle-radius": 6,
      "circle-stroke-width": 1.5,
      "circle-color": [
        "match",
        ["get", "severity"],
        "CRITICAL",
        "#FF1744",
        "HIGH",
        "#FF8C00",
        "MEDIUM",
        "#FFD600",
        "#999999"
      ],
      "circle-opacity": 0.82,
      "circle-stroke-color": "#000000"
    }
  });
}

// FIRMS severity-tiered layers. Three layers share a single source
// `firms-detections` and are separated by filter expressions keyed on
// the `severity` feature property. They are ADDED with
// `visibility: "none"` because the initial basemap mode is DARK and
// the rule is: FIRMS dots only appear in FIRMS basemap mode. The
// `applyBasemapModeStyling` helper flips visibility on mode changes.
//
// Rendering: `symbol` type with a programmatically-generated solid
// RGBA square icon per severity tier. NASA FIRMS renders detections
// as opaque uniform-colour squares (one per VIIRS/MODIS pixel) and
// that is what the user expects — not blurred circles. `icon-size`
// scales the base 16×16 PNG and `icon-allow-overlap` +
// `icon-ignore-placement` force every detection to render even when
// they bunch up at facility scale.
//   - `firms-normal-layer`   small orange square (NORMAL, #FF6B35)
//   - `firms-elevated-layer` mid orange-red square (ELEVATED, #FF3D00)
//   - `firms-alert-layer`    big red square (ALERT, #FF1744)
function registerFirmsSquareIcons(map: mapboxgl.Map) {
  const SIZE = 16;
  const iconConfigs: Array<{ id: string; rgba: [number, number, number, number] }> = [
    { id: "firms-square-normal", rgba: [255, 107, 53, 255] },   // #FF6B35
    { id: "firms-square-elevated", rgba: [255, 61, 0, 255] },    // #FF3D00
    { id: "firms-square-alert", rgba: [255, 23, 68, 255] }       // #FF1744
  ];

  for (const { id, rgba } of iconConfigs) {
    if (map.hasImage && map.hasImage(id)) {
      continue;
    }
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    for (let i = 0; i < SIZE * SIZE; i++) {
      const offset = i * 4;
      pixels[offset] = rgba[0];
      pixels[offset + 1] = rgba[1];
      pixels[offset + 2] = rgba[2];
      pixels[offset + 3] = rgba[3];
    }
    map.addImage(id, { width: SIZE, height: SIZE, data: pixels });
  }
}

function addFirmsLayers(map: mapboxgl.Map) {
  registerFirmsSquareIcons(map);

  if (!map.getLayer("firms-normal-layer")) {
    map.addLayer({
      id: "firms-normal-layer",
      source: "firms-detections",
      type: "symbol",
      filter: ["==", ["get", "severity"], "NORMAL"],
      layout: {
        visibility: "none",
        "icon-image": "firms-square-normal",
        "icon-size": 0.5,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map"
      },
      paint: {
        "icon-opacity": 1
      }
    });
  }

  if (!map.getLayer("firms-elevated-layer")) {
    map.addLayer({
      id: "firms-elevated-layer",
      source: "firms-detections",
      type: "symbol",
      filter: ["==", ["get", "severity"], "ELEVATED"],
      layout: {
        visibility: "none",
        "icon-image": "firms-square-elevated",
        "icon-size": 0.75,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map"
      },
      paint: {
        "icon-opacity": 1
      }
    });
  }

  if (!map.getLayer("firms-alert-layer")) {
    map.addLayer({
      id: "firms-alert-layer",
      source: "firms-detections",
      type: "symbol",
      filter: ["==", ["get", "severity"], "ALERT"],
      layout: {
        visibility: "none",
        "icon-image": "firms-square-alert",
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map"
      },
      paint: {
        "icon-opacity": 1
      }
    });
  }
}

function addFeedstockRiskLayer(map: mapboxgl.Map) {
  if (map.getLayer("refineries-feedstock-risk-layer")) {
    return;
  }

  map.addLayer({
    // Curated Hormuz dependency score (hydrated in workspaceData.ts from
    // refinery_feedstock.json) does the real work. A hard capacity floor
    // keeps tiny topping units off the map even when their score is high.
    // Both coalesce expressions default to 0 so uncurated or missing-
    // capacity features silently fall out of the layer.
    filter: [
      "all",
      [
        ">=",
        ["coalesce", ["get", "hormuzDependency"], 0],
        FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD
      ],
      [
        ">=",
        ["coalesce", ["get", "capacity_bpd"], 0],
        FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD
      ]
    ],
    id: "refineries-feedstock-risk-layer",
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["sqrt", ["/", ["coalesce", ["get", "capacity_bpd"], 0], 10000]],
        0,
        11,
        12,
        24
      ],
      "circle-stroke-color": "#FFD600",
      "circle-stroke-opacity": 0,
      "circle-stroke-width": 0
    },
    source: "refineries",
    type: "circle"
  });
}

// Dash-offset presets cycled by the rAF loop to fake "crude flowing" along
// the bypass pipelines. Each tuple is a valid `line-dasharray` — Mapbox only
// accepts positive finite numbers, so we rotate between four visually
// distinct dashes instead of trying to animate a true offset.
const BYPASS_DASH_PRESETS: ReadonlyArray<[number, number]> = [
  [4, 2],
  [3, 3],
  [2, 4],
  [3, 3]
];

const BYPASS_PIPELINE_LAYER_IDS = ["pipelines-bypass-glow-layer"] as const;

/**
 * Apply the static portion of the scenario visual state. Called on every
 * scenario-state transition plus any time the map style reloads. All values
 * come from pure helpers in `scenarioMapStyles.ts`.
 */
function syncScenarioLayers(map: mapboxgl.Map, state: ScenarioVisualState) {
  // --- Hormuz hazard overlay ---
  if (map.getLayer("chokepoints-hazard-layer")) {
    const hazardOpacity = computeHormuzHazardOpacity(state.disruptionPct);
    const hazardColor = computeHormuzHazardColor(state.disruptionPct);
    const hazardWidth = computeHormuzHazardWidth(state.disruptionPct);

    map.setPaintProperty("chokepoints-hazard-layer", "line-color", hazardColor);
    map.setPaintProperty("chokepoints-hazard-layer", "line-opacity", hazardOpacity);
    map.setPaintProperty("chokepoints-hazard-layer", "line-width", hazardWidth);
  }

  // --- Bypass pipeline glow (Saudi East-West + UAE ADCOP) ---
  // Each pipeline has its own utilisation, so we fold both into a per-feature
  // match expression for color and width. A pipeline that the model hasn't
  // drawn on stays dark because the glow layer's base opacity collapses to 0.
  if (map.getLayer("pipelines-bypass-glow-layer")) {
    const saudiOpacity = computeBypassGlowOpacity(state.saudiUtilisationPct);
    const uaeOpacity = computeBypassGlowOpacity(state.uaeUtilisationPct);
    const saudiColor = computeBypassGlowColor(state.saudiUtilisationPct);
    const uaeColor = computeBypassGlowColor(state.uaeUtilisationPct);
    const saudiWidthBonus = computeBypassGlowWidthBonus(state.saudiUtilisationPct);
    const uaeWidthBonus = computeBypassGlowWidthBonus(state.uaeUtilisationPct);

    // Use match expressions keyed on feature id so the two bypass lines
    // can light up independently according to their own utilisation. Any
    // non-matching line defaults to invisible (opacity 0, width 0) — but
    // the feature filter already restricts the layer to only the two IDs
    // so the fallback branch is just belt-and-suspenders.
    map.setPaintProperty("pipelines-bypass-glow-layer", "line-opacity", [
      "match",
      ["get", "id"],
      SAUDI_EAST_WEST_PIPELINE_ID,
      saudiOpacity,
      UAE_ADCOP_PIPELINE_ID,
      uaeOpacity,
      0
    ]);
    map.setPaintProperty("pipelines-bypass-glow-layer", "line-color", [
      "match",
      ["get", "id"],
      SAUDI_EAST_WEST_PIPELINE_ID,
      saudiColor,
      UAE_ADCOP_PIPELINE_ID,
      uaeColor,
      "#FF8C00"
    ]);
    // Base width (in pixels) + utilisation-driven bonus. Held constant here;
    // the rAF loop only touches the dash array.
    map.setPaintProperty("pipelines-bypass-glow-layer", "line-width", [
      "match",
      ["get", "id"],
      SAUDI_EAST_WEST_PIPELINE_ID,
      4 + saudiWidthBonus,
      UAE_ADCOP_PIPELINE_ID,
      4 + uaeWidthBonus,
      0
    ]);
  }

  // --- Refinery feedstock-risk warning ---
  // Only fires above the 50% disruption threshold. Below that, we hold the
  // outline at zero opacity/width so the layer is effectively invisible
  // without having to touch its filter.
  if (map.getLayer("refineries-feedstock-risk-layer")) {
    const riskActive = isFeedstockRiskActive(state.disruptionPct);
    const riskOpacity = riskActive
      ? computeFeedstockRiskOpacity(state.disruptionPct)
      : 0;
    const riskWidth = riskActive ? 3 : 0;

    map.setPaintProperty(
      "refineries-feedstock-risk-layer",
      "circle-stroke-opacity",
      riskOpacity
    );
    map.setPaintProperty(
      "refineries-feedstock-risk-layer",
      "circle-stroke-width",
      riskWidth
    );
  }
}

// All layers that participate in the "this is the selected asset" visual.
// Kept in sync by setting a filter on each one at selection time. The
// halo variants were removed — selection is now a single thin outline
// plus spotlight dimming on the rest.
const SELECTION_LAYER_IDS = [
  "refineries-selected-layer",
  "fields-selected-layer",
  "terminals-selected-layer",
  "pipelines-selected-layer",
  "chokepoints-selected-layer"
] as const;

function syncSelectedAsset(map: mapboxgl.Map, selectedAssetId: string | null) {
  const matchExpression = ["==", ["get", "id"], selectedAssetId ?? ""];

  SELECTION_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setFilter(layerId, matchExpression);
    }
  });

  applySpotlightDimming(map, selectedAssetId !== null);
}

// When an asset is selected we drop the opacity on everything that ISN'T the
// selected asset so the selection pops visually. Restored to default when
// nothing is selected.
const POINT_LAYERS_DIMMING: Array<{ id: string; activeOpacity: number; restOpacity: number }> = [
  { id: "refineries-layer", activeOpacity: 0.35, restOpacity: 0.9 },
  { id: "fields-layer", activeOpacity: 0.3, restOpacity: 0.85 },
  { id: "terminals-layer", activeOpacity: 0.35, restOpacity: 0.9 }
];

const LINE_LAYERS_DIMMING: Array<{ id: string; activeMultiplier: number; restProperty: unknown }> = [
  { id: "pipelines-layer", activeMultiplier: 0.3, restProperty: null },
  { id: "pipelines-casing-layer", activeMultiplier: 0.3, restProperty: 0.74 },
  { id: "pipelines-schematic-layer", activeMultiplier: 0.4, restProperty: 0.32 }
];

// Cap pulse FPS to keep the scenario rAF cheap on slower machines. 30
// FPS is well above the perception threshold for "smooth breathing"
// and below the rate at which Mapbox's setPaintProperty cost becomes
// noticeable. Used by the scenario animation loop.
const PULSE_FRAME_INTERVAL_MS = 33;
const PULSE_PERIOD_MS = 1600;

function applySpotlightDimming(map: mapboxgl.Map, isSelectionActive: boolean) {
  POINT_LAYERS_DIMMING.forEach(({ id, activeOpacity, restOpacity }) => {
    if (!map.getLayer(id)) {
      return;
    }
    map.setPaintProperty(id, "circle-opacity", isSelectionActive ? activeOpacity : restOpacity);
  });

  LINE_LAYERS_DIMMING.forEach(({ id, activeMultiplier, restProperty }) => {
    if (!map.getLayer(id)) {
      return;
    }

    if (id === "pipelines-layer") {
      // Base pipelines layer uses an expression for opacity; fall back to a
      // flat multiplier while a selection is active, then restore the
      // expression when the selection clears.
      if (isSelectionActive) {
        map.setPaintProperty(id, "line-opacity", activeMultiplier);
      } else {
        map.setPaintProperty(id, "line-opacity", PIPELINE_OPACITY_EXPRESSION_FOR_RESTORE);
      }
      return;
    }

    map.setPaintProperty(
      id,
      "line-opacity",
      isSelectionActive ? activeMultiplier : (restProperty as number)
    );
  });
}

// Mirrors the expression in mapLayerStyles.ts so we can restore it after a
// spotlight pass. Keep in sync if the pipeline opacity rules change there.
const PIPELINE_OPACITY_EXPRESSION_FOR_RESTORE = [
  "match",
  ["get", "status"],
  "construction",
  0.44,
  "proposed",
  0.4,
  "planned",
  0.48,
  0.72
] as never;

function syncHoveredAsset(map: mapboxgl.Map, hoveredAssetId: string | null) {
  if (map.getLayer("pipelines-hover-layer")) {
    map.setFilter("pipelines-hover-layer", ["==", ["get", "id"], hoveredAssetId ?? ""]);
  }

  if (map.getLayer("chokepoints-hover-layer")) {
    map.setFilter("chokepoints-hover-layer", ["==", ["get", "id"], hoveredAssetId ?? ""]);
  }
}

function ensurePointSource(map: mapboxgl.Map, id: string, data: GeoJsonPayload) {
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (existing) {
    // Source already exists (e.g. mid-session style swap). Refresh
    // the data so the new style renders with the latest features
    // instead of whatever the source was seeded with on first mount.
    existing.setData(data);
    return;
  }
  map.addSource(id, createPointSourceDefinition(data));
}

function ensureLineSource(map: mapboxgl.Map, id: string, data: GeoJsonPayload) {
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource(id, createLineSourceDefinition(data));
}

function setSourceData(map: mapboxgl.Map, id: string, data: GeoJsonPayload) {
  const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;

  source?.setData(data);
}

function buildPointCollection(assets: InfrastructureAsset[], kind: "refinery" | "field" | "terminal") : GeoJsonPayload {
  return {
    type: "FeatureCollection",
    features: assets
      .filter((asset): asset is Extract<InfrastructureAsset, { assetKind: typeof kind }> => asset.assetKind === kind)
      .map((asset) => {
        if (asset.assetKind === "refinery") {
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [asset.lon, asset.lat]
            },
            properties: {
              id: asset.id,
              status: asset.status,
              name: asset.name,
              capacity_bpd: asset.capacity_bpd,
              // Default missing scores to 0 ("assume resilient") so the
              // Mapbox filter coalesce expression treats uncurated
              // refineries as out of the risk layer.
              hormuzDependency: asset.hormuzDependency ?? 0
            }
          };
        }

        if (asset.assetKind === "field") {
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [asset.lon, asset.lat]
            },
            properties: {
              id: asset.id,
              status: asset.status,
              name: asset.name,
              fieldType: asset.fieldType ?? "mixed",
              production_bpd: asset.production_bpd ?? 0,
              reserves_mmboe: asset.reserves_mmboe ?? 0
            }
          };
        }

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [asset.lon, asset.lat]
          },
          properties: {
            id: asset.id,
            status: asset.status,
            name: asset.name,
            terminalRole: asset.terminalRole ?? "import",
            capacity_mtpa: asset.capacity_mtpa ?? 0
          }
        };
      })
  };
}

// Join curated outage events onto refinery coordinates. Returns an
// empty FeatureCollection when no events are supplied so the source
// always has a valid shape to `setData` against. Filters:
//   - Event must have an `assetId` that resolves to a refinery in the
//     current asset array (so unlinked events never anchor to [0,0])
//   - Event date must be within the outage map window (bounded so the
//     map never surfaces ancient history)
// Window is 5 years — matches the Brent historical chart's default
// window so the two surfaces are analytically paired. Shorter windows
// would zero out the curated historical seed entirely. Future curated
// near-real-time data can revisit this.
const OUTAGE_MAP_WINDOW_DAYS = 365 * 5;

function buildOutageEventCollection(
  events: OutageEvent[] | null,
  assets: InfrastructureAsset[]
): GeoJsonPayload {
  if (!events || events.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const refineryCoordsById = new Map<string, [number, number]>();
  for (const asset of assets) {
    if (asset.assetKind === "refinery") {
      refineryCoordsById.set(asset.id, [asset.lon, asset.lat]);
    }
  }

  const nowMs = Date.now();
  const cutoffMs = nowMs - OUTAGE_MAP_WINDOW_DAYS * 86_400_000;

  const features = events
    .filter((event) => {
      if (!event.assetId) return false;
      if (!refineryCoordsById.has(event.assetId)) return false;
      const eventMs = Date.parse(event.date);
      return Number.isFinite(eventMs) && eventMs >= cutoffMs;
    })
    .map((event) => {
      const coordinates = refineryCoordsById.get(event.assetId as string)!;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates },
        properties: {
          id: event.id,
          name: event.name,
          severity: event.severity,
          category: event.category,
          date: event.date,
          outageVolumeBpd: event.outageVolumeBpd
        }
      };
    });

  return { type: "FeatureCollection", features };
}

// Build a FeatureCollection for the FIRMS source from the current
// snapshot. Every geofence match becomes one point feature. The
// severity property comes from the per-facility anomaly score the
// `useFirms` hook computed — when a facility has no anomaly row
// (missing baseline), its detections default to NORMAL.
function buildFirmsDetectionCollection(
  firmsSnapshot: FirmsSnapshot | null
): GeoJsonPayload {
  if (!firmsSnapshot || firmsSnapshot.matches.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  // Index anomaly severity by asset id so every detection inherits
  // the severity of its containing facility. Detections at a facility
  // without a baseline fall through to NORMAL.
  const severityByAssetId = new Map<string, string>();
  for (const anomaly of firmsSnapshot.anomalies) {
    severityByAssetId.set(anomaly.asset.id, anomaly.severity);
  }

  const features = firmsSnapshot.matches.map((match) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [match.detection.longitude, match.detection.latitude]
    },
    properties: {
      id: match.detection.id,
      assetId: match.asset.id,
      assetName: match.asset.name,
      severity: severityByAssetId.get(match.asset.id) ?? "NORMAL",
      acquiredAt: match.detection.acquiredAt,
      confidenceScore: match.detection.confidenceScore,
      frp: match.detection.frp,
      satellite: match.detection.satellite
    }
  }));

  return { type: "FeatureCollection", features };
}

function buildLineCollection(assets: InfrastructureAsset[], kind: "pipeline" | "chokepoint"): GeoJsonPayload {
  return {
    type: "FeatureCollection",
    features: assets
      .filter((asset): asset is Extract<InfrastructureAsset, { assetKind: typeof kind }> => asset.assetKind === kind)
      .map((asset) => ({
        type: "Feature",
        geometry: asset.geometry,
        properties: {
          id: asset.id,
          hydrocarbon: asset.assetKind === "pipeline" ? asset.hydrocarbon : null,
          capacity_boed: asset.assetKind === "pipeline" ? asset.capacity_boed ?? 0 : 0,
          geometryConfidence: asset.assetKind === "pipeline" ? asset.geometryConfidence : "high",
          name: asset.name,
          status: asset.status
        }
      }))
  };
}

function extendBoundsForLineGeometry(
  bounds: mapboxgl.LngLatBounds,
  geometry: Extract<InfrastructureAsset, { assetKind: "pipeline" | "chokepoint" }>["geometry"]
) {
  if (geometry.type === "LineString") {
    geometry.coordinates.forEach((coordinate) => {
      bounds.extend(coordinate);
    });
    return;
  }

  geometry.coordinates.forEach((segment) => {
    segment.forEach((coordinate) => {
      bounds.extend(coordinate);
    });
  });
}

function syncMapStyle(
  map: mapboxgl.Map,
  assets: InfrastructureAsset[],
  selectedAssetId: string | null,
  hoveredAssetId: string | null,
  outageEvents: OutageEvent[] | null,
  firmsSnapshot: FirmsSnapshot | null
) {
  map.setProjection("mercator");

  ensurePointSource(map, "refineries", buildPointCollection(assets, "refinery"));
  ensurePointSource(map, "fields", buildPointCollection(assets, "field"));
  ensurePointSource(map, "terminals", buildPointCollection(assets, "terminal"));
  ensureLineSource(map, "pipelines", buildLineCollection(assets, "pipeline"));
  ensureLineSource(map, "chokepoints", buildLineCollection(assets, "chokepoint"));
  ensurePointSource(
    map,
    "outage-events",
    buildOutageEventCollection(outageEvents, assets)
  );
  ensurePointSource(
    map,
    "firms-detections",
    buildFirmsDetectionCollection(firmsSnapshot)
  );

  addRefineryLayers(map);
  addFieldLayers(map);
  addTerminalLayers(map);
  addPipelineLayers(map);
  addChokepointLayers(map);
  // Scenario override layers sit on top of their base counterparts and
  // start fully transparent. They light up on scenario engage via
  // syncScenarioLayers + the scenario rAF loop.
  addBypassGlowLayer(map);
  addHormuzHazardLayer(map);
  addFeedstockRiskLayer(map);
  addOutageEventLayer(map);
  // FIRMS layers sit above the base markers so NORMAL dim dots are
  // visible over refineries, and ALERT pulses dominate everything.
  addFirmsLayers(map);
  syncSelectedAsset(map, selectedAssetId);
  syncHoveredAsset(map, hoveredAssetId);
}

function getBasemapStyleUrl(mode: BasemapMode): string {
  // FIRMS mode uses the same satellite base style as SATELLITE mode;
  // the "firms feel" comes from dimming asset layers + amplifying the
  // FIRMS detection layers (see `applyBasemapModeStyling`).
  if (mode === "dark") {
    return TERMINAL_DARK_STYLE_URL;
  }
  return SATELLITE_STYLE_URL;
}

// Basemap mode picker is a 3-segment toggle — all modes visible at
// once so the user can see which mode they are in and jump directly
// to any other mode without cycling through an intermediate state.
const ASSET_LABEL_LAYER_IDS = [
  "refineries-label-layer",
  "fields-label-layer",
  "terminals-label-layer"
] as const;

export const BASEMAP_MODE_OPTIONS: readonly BasemapMode[] = ["dark", "satellite", "firms"] as const;

export const BASEMAP_MODE_LABELS: Record<BasemapMode, string> = {
  dark: "DARK",
  satellite: "SAT",
  firms: "FIRMS"
};

// Drives the "this is FIRMS mode" visual. FIRMS is a separate mode,
// NOT a layer on top of dark/satellite:
//
//   DARK / SATELLITE → infrastructure layers visible, FIRMS layers
//   completely hidden. The map reads as a clean infrastructure +
//   basemap combo with zero fire/thermal noise.
//
//   FIRMS            → infrastructure layers completely hidden,
//   FIRMS layers visible as big red blurry splotches on top of the
//   satellite base, matching the look of firms.modaps.eosdis.nasa.gov.
//
// The layer-swap uses Mapbox's `layout.visibility` rather than opacity
// so hidden layers don't even hit-test. Radii + blur are boosted on
// the FIRMS layers themselves so each detection reads as a red patch
// rather than a precise dot.
function applyBasemapModeStyling(map: mapboxgl.Map, mode: BasemapMode) {
  const isFirms = mode === "firms";
  const infraVisibility = isFirms ? "none" : "visible";
  const firmsVisibility = isFirms ? "visible" : "none";

  const infraLayers = [
    "refineries-layer",
    "refineries-feedstock-risk-layer",
    "refineries-selected-layer",
    "refineries-label-layer",
    "fields-layer",
    "fields-selected-layer",
    "fields-label-layer",
    "terminals-layer",
    "terminals-selected-layer",
    "terminals-label-layer",
    "pipelines-casing-layer",
    "pipelines-layer",
    "pipelines-schematic-layer",
    "pipelines-selected-layer",
    "pipelines-hit-layer",
    "chokepoints-casing-layer",
    "chokepoints-layer",
    "chokepoints-selected-layer",
    "chokepoints-hazard-layer",
    "chokepoints-hit-layer",
    "pipelines-bypass-glow-layer",
    "outage-events-layer"
  ];
  for (const layerId of infraLayers) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", infraVisibility);
  }

  const firmsLayers = ["firms-normal-layer", "firms-elevated-layer", "firms-alert-layer"];
  for (const layerId of firmsLayers) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", firmsVisibility);
  }

  if (!isFirms) {
    return;
  }

  // In FIRMS mode the symbol layers render solid opaque squares.
  // Baseline `icon-size` is set at layer creation time — we re-apply
  // here because swapping basemap styles drops layout properties on
  // some code paths, and we want every mode switch into FIRMS to be
  // idempotent. Opacity stays at 1 (solid), no blur, no gradient —
  // the goal is to read like a raster pixel, matching the NASA FIRMS
  // site.
  if (map.getLayer("firms-normal-layer")) {
    map.setLayoutProperty("firms-normal-layer", "icon-size", 0.5);
    map.setPaintProperty("firms-normal-layer", "icon-opacity", 1);
  }
  if (map.getLayer("firms-elevated-layer")) {
    map.setLayoutProperty("firms-elevated-layer", "icon-size", 0.75);
    map.setPaintProperty("firms-elevated-layer", "icon-opacity", 1);
  }
  if (map.getLayer("firms-alert-layer")) {
    map.setLayoutProperty("firms-alert-layer", "icon-size", 1);
    map.setPaintProperty("firms-alert-layer", "icon-opacity", 1);
  }
}

// --- Map Display Settings helpers ---

/* setPaintProperty's generic overloads are too strict for dynamic
   expressions built at runtime. This thin wrapper avoids per-call
   casts while keeping the rest of the file type-safe. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setPaint(map: mapboxgl.Map, layer: string, prop: any, value: any) {
  map.setPaintProperty(layer, prop, value);
}

function applyMapDisplaySettings(
  map: mapboxgl.Map,
  settings: MapDisplaySettings | undefined,
  basemapMode: BasemapMode
) {
  if (!settings) {
    return;
  }

  const scale = settings.pointSize / 3;

  // --- Point Size + Size By ---
  if (map.getLayer("refineries-layer")) {
    setPaint(
      map,
      "refineries-layer",
      "circle-radius",
      buildRadiusExpression("capacity_bpd", settings.sizeBy, scale, 10000, 4, 15)
    );
  }
  if (map.getLayer("fields-layer")) {
    const fieldProp = settings.sizeBy === "reserves" ? "reserves_mmboe" : "production_bpd";
    const fieldMax = settings.sizeBy === "reserves" ? 5000 : 1000000;
    setPaint(
      map,
      "fields-layer",
      "circle-radius",
      buildRadiusExpression(fieldProp, settings.sizeBy, scale, 1, 3, 9, fieldMax)
    );
  }
  if (map.getLayer("terminals-layer")) {
    setPaint(
      map,
      "terminals-layer",
      "circle-radius",
      buildRadiusExpression("capacity_mtpa", settings.sizeBy, scale, 1, 4, 13, 50)
    );
  }

  // --- Color By ---
  applyColorBySettings(map, settings.colorBy);

  // --- Labels toggle ---
  ensureAssetLabelLayers(map);
  const labelVisibility =
    settings.showLabels && basemapMode !== "firms" ? "visible" : "none";
  for (const layerId of ASSET_LABEL_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", labelVisibility);
    }
  }
}

function buildRadiusExpression(
  property: string,
  sizeBy: SizeByOption,
  scale: number,
  divisor: number,
  minRadius: number,
  maxRadius: number,
  maxValue?: number
): number | unknown[] {
  const sMin = Math.round(minRadius * scale * 10) / 10;
  const sMax = Math.round(maxRadius * scale * 10) / 10;

  if (sizeBy === "uniform") {
    return Math.round(((sMin + sMax) / 2) * 10) / 10;
  }

  // For capacity-style sqrt scaling (refineries default)
  if (!maxValue) {
    return [
      "interpolate",
      ["linear"],
      ["sqrt", ["/", ["coalesce", ["get", property], 0], divisor]],
      0,
      sMin,
      12,
      sMax
    ];
  }

  // For linear interpolation with a known max (fields, terminals)
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", property], 0],
    0,
    sMin,
    maxValue,
    sMax
  ];
}

function applyColorBySettings(map: mapboxgl.Map, colorBy: ColorByOption) {
  const statusColorExpr = [
    "match", ["get", "status"],
    "operational", "#00C853",
    "operating", "#00C853",
    "planned_startup", "#FF8C00",
    "planned_maintenance", "#FFD600",
    "unplanned_incident", "#FF1744",
    "construction", "#2196F3",
    "unknown", "#666666",
    "#555555"
  ];
  const hydrocarbonColorExpr = [
    "match", ["get", "fieldType"],
    "oil", "#FF8C00",
    "gas", "#64B5F6",
    "mixed", "#E0E0E0",
    "condensate", "#FFCC80",
    "#999999"
  ];

  if (map.getLayer("refineries-layer")) {
    setPaint(
      map, "refineries-layer", "circle-color",
      colorBy === "status" ? statusColorExpr : "#FF8C00"
    );
  }
  if (map.getLayer("fields-layer")) {
    setPaint(
      map, "fields-layer", "circle-color",
      colorBy === "hydrocarbon" ? hydrocarbonColorExpr : statusColorExpr
    );
  }
  if (map.getLayer("terminals-layer")) {
    const termExpr = colorBy === "hydrocarbon"
      ? ["match", ["get", "terminalRole"], "export", "#FF8C00", "import", "#64B5F6", "#E0E0E0"]
      : statusColorExpr;
    setPaint(map, "terminals-layer", "circle-color", termExpr);
  }
}

function ensureAssetLabelLayers(map: mapboxgl.Map) {
  const labelConfig: Array<{ id: string; source: string }> = [
    { id: "refineries-label-layer", source: "refineries" },
    { id: "fields-label-layer", source: "fields" },
    { id: "terminals-label-layer", source: "terminals" }
  ];

  for (const { id, source } of labelConfig) {
    if (map.getLayer(id) || !map.getSource(source)) {
      continue;
    }

    map.addLayer({
      id,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-size": 10,
        "text-max-width": 12,
        visibility: "none"
      },
      paint: {
        "text-color": "#E0E0E0",
        "text-halo-color": "#000000",
        "text-halo-width": 1
      },
      source,
      type: "symbol"
    });
  }
}
