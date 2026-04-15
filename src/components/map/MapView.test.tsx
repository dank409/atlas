import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChokepointAsset } from "../../types/Infrastructure";

const mapboxMock = vi.hoisted(() => {
  const state = {
    latestMapInstance: null as null | InstanceType<typeof MockMap>,
    mapConstructor: vi.fn()
  };

  class MockMap {
    addControl = vi.fn();
    addImage = vi.fn();
    addLayer = vi.fn();
    addSource = vi.fn();
    hasImage = vi.fn(() => false);
    dragRotate = { disable: vi.fn() };
    fitBounds = vi.fn();
    flyTo = vi.fn();
    getBearing = vi.fn(() => 0);
    getCanvas = vi.fn(() => ({ style: {} }));
    getCenter = vi.fn(() => ({ lat: 25.6, lng: 50.4 }));
    getLayer = vi.fn(() => undefined);
    getPitch = vi.fn(() => 0);
    getSource = vi.fn(() => undefined);
    getZoom = vi.fn(() => 6.8);
    handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    isStyleLoaded = vi.fn(() => true);
    jumpTo = vi.fn();
    queryRenderedFeatures = vi.fn(() => []);
    remove = vi.fn();
    resize = vi.fn();
    setFilter = vi.fn();
    setPaintProperty = vi.fn();
    setProjection = vi.fn();
    setStyle = vi.fn((style: string) => {
      this.style = style;
      this.emit("style.load");
    });
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
});
