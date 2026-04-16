import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChokepointAsset,
  FieldAsset,
  RefineryAsset,
  TerminalAsset
} from "../../types/Infrastructure";
import type { MapDisplaySettings } from "../../types/mapDisplaySettings";

const mapboxMock = vi.hoisted(() => {
  const state = {
    latestMapInstance: null as null | InstanceType<typeof MockMap>,
    mapConstructor: vi.fn()
  };

  class MockMap {
    addControl = vi.fn();
    addImage = vi.fn();
    addLayer = vi.fn((layer: { id: string }) => {
      this.layers.set(layer.id, layer);
    });
    addSource = vi.fn((id: string, source: { data: unknown }) => {
      const storedSource = {
        ...source,
        setData: vi.fn((data: unknown) => {
          storedSource.data = data;
        })
      };
      this.sources.set(id, storedSource);
    });
    hasImage = vi.fn(() => false);
    dragRotate = { disable: vi.fn() };
    fitBounds = vi.fn();
    flyTo = vi.fn();
    getBearing = vi.fn(() => 0);
    getCanvas = vi.fn(() => ({ style: {} }));
    getCenter = vi.fn(() => ({ lat: 25.6, lng: 50.4 }));
    getLayer = vi.fn((id: string) => this.layers.get(id));
    getPitch = vi.fn(() => 0);
    getSource = vi.fn((id: string) => this.sources.get(id));
    getZoom = vi.fn(() => 6.8);
    handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    isStyleLoaded = vi.fn(() => true);
    jumpTo = vi.fn();
    layers = new Map<string, { id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }>();
    queryRenderedFeatures = vi.fn(() => []);
    remove = vi.fn();
    resize = vi.fn();
    setFilter = vi.fn();
    setLayoutProperty = vi.fn((layerId: string, prop: string, value: unknown) => {
      const layer = this.layers.get(layerId);
      if (layer) {
        layer.layout = { ...(layer.layout ?? {}), [prop]: value };
      }
    });
    setPaintProperty = vi.fn((layerId: string, prop: string, value: unknown) => {
      const layer = this.layers.get(layerId);
      if (layer) {
        layer.paint = { ...(layer.paint ?? {}), [prop]: value };
      }
    });
    setProjection = vi.fn();
    setStyle = vi.fn((style: string) => {
      this.style = style;
      this.layers.clear();
      this.sources.clear();
      this.emit("style.load");
    });
    sources = new Map<string, { data: unknown; setData: ReturnType<typeof vi.fn> }>();
    style: string;
    touchZoomRotate = { disableRotation: vi.fn() };

    constructor(options: { style: string }) {
      this.style = options.style;
      state.mapConstructor(options);
      state.latestMapInstance = this;
    }

    emit(type: string) {
      this.handlers[type]?.forEach((handler) => handler());
    }

    on(type: string, layerOrHandler: unknown, maybeHandler?: unknown) {
      const handler =
        typeof layerOrHandler === "function"
          ? (layerOrHandler as (...args: unknown[]) => void)
          : (maybeHandler as (...args: unknown[]) => void);

      this.handlers[type] ??= [];
      this.handlers[type].push(handler);

      if (type === "load" || type === "style.load") {
        queueMicrotask(() => {
          handler();
        });
      }

      return this;
    }

    once(type: string, handler: (...args: unknown[]) => void) {
      // Mapbox's `once` fires the handler at most one time. In the
      // mock, `style.load` is emitted via `queueMicrotask` from the
      // constructor path, so scheduling the same way here keeps the
      // test's timing identical to the real lifecycle.
      if (type === "load" || type === "style.load") {
        queueMicrotask(() => {
          handler();
        });
      } else {
        const wrapper = (...args: unknown[]) => {
          handler(...args);
        };
        this.handlers[type] ??= [];
        this.handlers[type].push(wrapper);
      }
      return this;
    }

    off() {
      // Mock tolerates `.off(...)` calls without tracking them; the
      // test isn't asserting listener removal, only that it doesn't
      // throw when React cleans up mid-effect.
      return this;
    }
  }

  class MockLngLatBounds {
    extend = vi.fn();
  }

  return {
    MockLngLatBounds,
    MockMap,
    state
  };
});

vi.mock("mapbox-gl", () => ({
  default: {
    Map: mapboxMock.MockMap,
    NavigationControl: vi.fn(),
    accessToken: "",
    LngLatBounds: mapboxMock.MockLngLatBounds
  }
}));

import { MapView } from "./MapView";

const refineryAsset: RefineryAsset = {
  assetKind: "refinery",
  capacity_bpd: 837000,
  capacityUnit: "bpd",
  country: "AE",
  countryName: "United Arab Emirates",
  datasetId: "refineries",
  id: "refinery-ruwais",
  lat: 24.1108,
  lon: 54.0894,
  name: "Ruwais Refinery",
  operator: "ADNOC Refining",
  owner: "ADNOC",
  status: "operational",
  _metadata: {
    downloadDate: "2026-04-14",
    source: "OGIM"
  }
};

const fieldAsset: FieldAsset = {
  assetKind: "field",
  basin: "Rub' al Khali",
  country: "SA",
  countryName: "Saudi Arabia",
  datasetId: "fields",
  fieldType: "oil",
  id: "field-shaybah",
  lat: 22.5,
  lon: 53.9,
  name: "Shaybah Field",
  operator: "Saudi Aramco",
  production_bpd: 1000000,
  reserves_mmboe: 14700,
  status: "operating",
  _metadata: {
    downloadDate: "2026-04-14",
    source: "GEM"
  }
};

const terminalAsset: TerminalAsset = {
  assetKind: "terminal",
  capacity_mtpa: 15.0,
  country: "QA",
  countryName: "Qatar",
  datasetId: "terminals",
  id: "terminal-ras-laffan",
  lat: 25.9167,
  lon: 51.55,
  name: "Ras Laffan LNG Terminal",
  status: "operating",
  terminalRole: "export",
  terminalType: "lng_terminal",
  _metadata: {
    downloadDate: "2026-04-14",
    source: "GEM"
  }
};

const CUSTOM_DISPLAY_SETTINGS: MapDisplaySettings = {
  pointSize: 4,
  sizeBy: "uniform",
  colorBy: "status",
  showLabels: true
};

describe("MapView", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.test-token");
    mapboxMock.state.latestMapInstance = null;
    mapboxMock.state.mapConstructor.mockClear();
  });

  it("switches basemap style without rebuilding the map instance", async () => {
    const chokepoint: ChokepointAsset = {
      assetKind: "chokepoint",
      country: "AE",
      countryName: "United Arab Emirates",
      datasetId: "chokepoints",
      geometry: {
        type: "LineString",
        coordinates: [
          [54.9, 25.7],
          [55.1, 25.8]
        ]
      },
      id: "cp-hormuz",
      linkedContext: {
        benchmarkRefs: ["BRN", "WTI"],
        countryCode: "AE"
      },
      name: "Strait Of Hormuz",
      status: "strategic",
      transitVolume_mbpd: 20.5,
      _metadata: {
        downloadDate: "2026-04-13",
        source: "Curated chokepoints"
      }
    };

    const { rerender } = render(
      <MapView
        activeDatasetIds={["chokepoints"]}
        hasError={false}
        basemapMode="dark"
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[chokepoint]}
      />
    );

    await waitFor(() => {
      expect(mapboxMock.state.mapConstructor).toHaveBeenCalledTimes(1);
    });

    rerender(
      <MapView
        activeDatasetIds={["chokepoints"]}
        hasError={false}
        basemapMode="satellite"
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[chokepoint]}
      />
    );

    await waitFor(() => {
      expect(mapboxMock.state.latestMapInstance?.setStyle).toHaveBeenCalledTimes(1);
    });

    expect(mapboxMock.state.mapConstructor).toHaveBeenCalledTimes(1);
    expect(mapboxMock.state.latestMapInstance?.jumpTo).toHaveBeenCalledWith({
      bearing: 0,
      center: { lat: 25.6, lng: 50.4 },
      pitch: 0,
      zoom: 6.8
    });
  });

  it("applies display settings after style load and reapplies them after a style swap", async () => {
    const { rerender } = render(
      <MapView
        activeDatasetIds={["refineries", "fields", "terminals"]}
        basemapMode="dark"
        hasError={false}
        mapDisplaySettings={CUSTOM_DISPLAY_SETTINGS}
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[refineryAsset, fieldAsset, terminalAsset]}
      />
    );

    await waitFor(() => {
      expect(
        mapboxMock.state.latestMapInstance?.layers.get("fields-label-layer")?.layout?.visibility
      ).toBe("visible");
    });

    expect(
      mapboxMock.state.latestMapInstance?.layers.get("fields-layer")?.paint?.["circle-color"]
    ).toEqual([
      "match",
      ["get", "status"],
      "operational",
      "#00C853",
      "operating",
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
    ]);

    rerender(
      <MapView
        activeDatasetIds={["refineries", "fields", "terminals"]}
        basemapMode="satellite"
        hasError={false}
        mapDisplaySettings={CUSTOM_DISPLAY_SETTINGS}
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[refineryAsset, fieldAsset, terminalAsset]}
      />
    );

    await waitFor(() => {
      expect(
        mapboxMock.state.latestMapInstance?.layers.get("fields-label-layer")?.layout?.visibility
      ).toBe("visible");
    });
    expect(
      mapboxMock.state.latestMapInstance?.layers.get("fields-layer")?.paint?.["circle-color"]
    ).toEqual([
      "match",
      ["get", "status"],
      "operational",
      "#00C853",
      "operating",
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
    ]);
  });

  it("includes reserves in the fields GeoJSON source for reserves sizing", async () => {
    render(
      <MapView
        activeDatasetIds={["fields"]}
        basemapMode="dark"
        hasError={false}
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[fieldAsset]}
      />
    );

    await waitFor(() => {
      const fieldsSource = mapboxMock.state.latestMapInstance?.sources.get("fields");
      expect(fieldsSource).toBeDefined();
      expect(
        (fieldsSource?.data as { features: Array<{ properties: { reserves_mmboe?: number } }> })
          .features[0]?.properties.reserves_mmboe
      ).toBe(14700);
    });
  });

  it("keeps asset labels hidden while FIRMS mode is active", async () => {
    const { rerender } = render(
      <MapView
        activeDatasetIds={["refineries", "fields", "terminals"]}
        basemapMode="firms"
        hasError={false}
        mapDisplaySettings={{ ...CUSTOM_DISPLAY_SETTINGS, showLabels: false }}
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[refineryAsset, fieldAsset, terminalAsset]}
      />
    );

    await waitFor(() => {
      expect(mapboxMock.state.latestMapInstance?.layers.get("refineries-layer")).toBeDefined();
    });

    rerender(
      <MapView
        activeDatasetIds={["refineries", "fields", "terminals"]}
        basemapMode="firms"
        hasError={false}
        mapDisplaySettings={CUSTOM_DISPLAY_SETTINGS}
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        selectedAssetId={null}
        visibleAssets={[refineryAsset, fieldAsset, terminalAsset]}
      />
    );

    await waitFor(() => {
      expect(
        mapboxMock.state.latestMapInstance?.layers.get("refineries-label-layer")?.layout?.visibility
      ).toBe("none");
    });
  });
});
