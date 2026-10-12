import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeField, makePipeline, makeRefinery, makeTerminal } from "../../test/fixtures";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import { REGION_BOUNDS, getMaxBounds } from "./mapRegion";

// Minimal stand-in for mapbox-gl's Map: records sources, layers and paint
// writes so the tests can assert what MapView asked the map to draw.
const mapboxMock = vi.hoisted(() => {
  type Handler = (event?: unknown) => void;
  type StoredLayer = { filter?: unknown; id: string; layout: Record<string, unknown>; paint: Record<string, unknown> };

  class MockMap {
    static latest: MockMap | null = null;
    static constructed = 0;

    handlers: Record<string, Handler[]> = {};
    layers = new Map<string, StoredLayer>();
    sources = new Map<string, { data: { features: unknown[] }; setData: (data: { features: unknown[] }) => void }>();
    renderedFeatures: unknown[] = [];
    canvas = { style: { cursor: "" } };
    dragRotate = { disable: vi.fn() };
    touchZoomRotate = { disableRotation: vi.fn() };
    addControl = vi.fn();
    images = new Map<string, { data: Uint8ClampedArray; width: number }>();
    fitBounds = vi.fn();
    flyTo = vi.fn();
    remove = vi.fn();
    resize = vi.fn();
    setMaxBounds = vi.fn();
    setStyle = vi.fn((style: string) => {
      this.style = style;
      this.layers.clear();
      this.sources.clear();
      this.images.clear();
      this.emit("style.load");
    });
    style: string;
    options: { bounds?: unknown; maxBounds?: unknown; style: string };

    constructor(options: { bounds?: unknown; maxBounds?: unknown; style: string }) {
      this.options = options;
      this.style = options.style;
      MockMap.latest = this;
      MockMap.constructed += 1;
    }

    on(type: string, handler: Handler) {
      (this.handlers[type] ??= []).push(handler);
      return this;
    }

    emit(type: string, event?: unknown) {
      this.handlers[type]?.forEach((handler) => handler(event));
    }

    addImage(id: string, image: { data: Uint8ClampedArray; width: number }) {
      this.images.set(id, image);
    }

    addSource(id: string, source: { data: { features: unknown[] } }) {
      const stored = {
        data: source.data,
        setData: (data: { features: unknown[] }) => {
          stored.data = data;
        }
      };
      this.sources.set(id, stored);
    }

    addLayer(layer: { filter?: unknown; id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }) {
      this.layers.set(layer.id, { ...layer, layout: { ...layer.layout }, paint: { ...layer.paint } });
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    getLayer(id: string) {
      return this.layers.get(id);
    }

    getCanvas() {
      return this.canvas;
    }

    getZoom() {
      return 4.3;
    }

    getStyle() {
      return { layers: Array.from(this.layers.values()) };
    }

    queryRenderedFeatures() {
      return this.renderedFeatures;
    }

    setFilter(id: string, filter: unknown) {
      this.layers.get(id)!.filter = filter;
    }

    setPaintProperty(id: string, property: string, value: unknown) {
      this.layers.get(id)!.paint[property] = value;
    }

    setLayoutProperty(id: string, property: string, value: unknown) {
      this.layers.get(id)!.layout[property] = value;
    }
  }

  class MockLngLatBounds {
    points: unknown[] = [];

    extend(point: unknown) {
      this.points.push(point);
      return this;
    }
  }

  return { MockLngLatBounds, MockMap };
});

vi.mock("mapbox-gl", () => ({
  default: {
    LngLatBounds: mapboxMock.MockLngLatBounds,
    Map: mapboxMock.MockMap,
    NavigationControl: class {},
    accessToken: ""
  }
}));

const { MapView } = await import("./MapView");

const ruwais = makeRefinery();
const ghawar = makeField();
const eastWest = makePipeline();
const ASSETS: InfrastructureAsset[] = [ruwais, ghawar, eastWest];

type MapViewProps = Parameters<typeof MapView>[0];

function buildProps(overrides: Partial<MapViewProps> = {}): MapViewProps {
  return {
    basemapMode: "dark",
    focus: null,
    hasError: false,
    isLoading: false,
    isVisible: true,
    onClearSelection: vi.fn(),
    onSelectAsset: vi.fn(),
    onSelectBasemap: vi.fn(),
    onShowAll: vi.fn(),
    selectedAssetId: null,
    showUnmappedRoutes: true,
    visibleAssets: ASSETS,
    ...overrides
  };
}

function renderMap(overrides: Partial<MapViewProps> = {}) {
  const props = buildProps(overrides);
  const view = render(<MapView {...props} />);
  const map = mapboxMock.MockMap.latest!;

  act(() => map.emit("style.load"));

  return {
    map,
    props,
    rerender: (next: Partial<MapViewProps>) => view.rerender(<MapView {...props} {...next} />),
    unmount: view.unmount
  };
}

function features(map: InstanceType<typeof mapboxMock.MockMap>, sourceId: string) {
  return map.getSource(sourceId)!.data.features as Array<{ properties: Record<string, unknown> }>;
}

describe("MapView", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.test");
    mapboxMock.MockMap.latest = null;
    mapboxMock.MockMap.constructed = 0;
  });

  it("asks for a token instead of creating a map when none is configured", () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "");
    render(<MapView {...buildProps()} />);

    expect(screen.getByText(/MAPBOX TOKEN REQUIRED/)).toBeInTheDocument();
    expect(mapboxMock.MockMap.constructed).toBe(0);
  });

  it("shows an error state instead of a map when the data failed to load", () => {
    render(<MapView {...buildProps({ hasError: true, visibleAssets: [] })} />);

    expect(screen.getByText("MAP DATA UNAVAILABLE")).toBeInTheDocument();
    expect(mapboxMock.MockMap.constructed).toBe(0);
  });

  it("adds one source per layer and sorts assets into them", () => {
    const { map } = renderMap();

    expect(Array.from(map.sources.keys())).toEqual(["pipelines", "fields", "terminals", "refineries"]);
    expect(features(map, "refineries")).toHaveLength(1);
    expect(features(map, "fields")).toHaveLength(1);
    expect(features(map, "pipelines")).toHaveLength(1);
    expect(features(map, "terminals")).toHaveLength(0);
  });

  it("registers a marker icon for each shaped layer before adding the layers", () => {
    const { map } = renderMap();

    expect(Array.from(map.images.keys())).toEqual(["atlas-refinery", "atlas-lng-terminal"]);
    expect(map.getLayer("refineries-layer")).toBeDefined();
  });

  it("tags each feature with the energy type and operating flag the styles read", () => {
    const proposedGasLine = makePipeline({ hydrocarbon: "natural_gas", id: "pipeline-proposed", status: "proposed" });
    const importTerminal = makeTerminal({ terminalRole: "import" });
    const { map } = renderMap({ visibleAssets: [ruwais, proposedGasLine, importTerminal] });

    expect(features(map, "refineries")[0].properties).toMatchObject({ energy: "oil", isOperating: true, sizeValue: 837000 });
    expect(features(map, "pipelines")[0].properties).toMatchObject({ energy: "gas", isOperating: false });
    expect(features(map, "terminals")[0].properties).toMatchObject({ energy: "gas", terminalRole: "import" });
  });

  it("draws a pipeline's mapped stretches and its long straight joins as separate features", () => {
    const partlyMapped = makePipeline({
      geometry: {
        coordinates: [
          [49.0, 26.0],
          [49.1, 26.0],
          [49.2, 26.0],
          [39.2, 26.0]
        ],
        type: "LineString"
      },
      id: "pipeline-partly-mapped"
    });
    const { map } = renderMap({ visibleAssets: [partlyMapped] });

    expect(features(map, "pipelines").map((feature) => feature.properties)).toEqual([
      expect.objectContaining({ id: "pipeline-partly-mapped", isRouteMapped: true }),
      expect.objectContaining({ id: "pipeline-partly-mapped", isRouteMapped: false })
    ]);
  });

  it("hides the dashed joins, and takes them out of hover and click, when asked to", () => {
    const { map, rerender } = renderMap();

    expect(map.getLayer("pipelines-schematic-layer")!.layout.visibility).toBe("visible");
    expect(map.getLayer("pipelines-hit-layer")!.filter).toBeNull();

    rerender({ showUnmappedRoutes: false });

    expect(map.getLayer("pipelines-schematic-layer")!.layout.visibility).toBe("none");
    expect(map.getLayer("pipelines-hit-layer")!.filter).toEqual(["==", ["get", "isRouteMapped"], true]);
    // A selected pipeline is still drawn whole.
    expect(map.getLayer("pipelines-selected-layer")!.layout.visibility).toBeUndefined();
  });

  it("pushes new data to the sources when the visible assets change", () => {
    const { map, rerender } = renderMap();

    rerender({ visibleAssets: [ruwais] });

    expect(features(map, "refineries")).toHaveLength(1);
    expect(features(map, "fields")).toHaveLength(0);
    expect(features(map, "pipelines")).toHaveLength(0);
  });

  it("offers to show everything when nothing is visible, but not while data is loading", async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderMap({ isLoading: true, visibleAssets: [] });

    expect(screen.queryByText("NO ASSETS VISIBLE")).not.toBeInTheDocument();

    rerender({ isLoading: false, visibleAssets: [] });
    await user.click(screen.getByRole("button", { name: "SHOW ALL" }));

    expect(props.onShowAll).toHaveBeenCalledTimes(1);
  });

  it("rings the selected point asset, dims the rest and flies to it", () => {
    const { map, rerender } = renderMap();

    rerender({ selectedAssetId: ruwais.id });

    expect(map.getLayer("refineries-selected-layer")!.filter).toEqual(["==", ["get", "id"], ruwais.id]);
    expect(map.getLayer("fields-layer")!.paint["circle-opacity"]).toEqual([
      "case",
      ["==", ["get", "id"], ruwais.id],
      1,
      0.5
    ]);
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [ruwais.lon, ruwais.lat], zoom: 6.5 }));
  });

  it("fits the camera to a selected pipeline's full route", () => {
    const { map, rerender } = renderMap();

    rerender({ selectedAssetId: eastWest.id });

    expect(map.getLayer("pipelines-selected-layer")!.filter).toEqual(["==", ["get", "id"], eastWest.id]);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it("restores resting opacity when the selection clears", () => {
    const { map, rerender } = renderMap({ selectedAssetId: ruwais.id });

    rerender({ selectedAssetId: null });

    expect(map.getLayer("refineries-layer")!.paint["icon-opacity"]).toEqual(["case", ["get", "isOperating"], 1, 0.45]);
    expect(map.getLayer("refineries-selected-layer")!.filter).toEqual(["==", ["get", "id"], ""]);
  });

  it("holds the camera while hidden and moves once when shown again", () => {
    const { map, rerender } = renderMap({ isVisible: false });

    rerender({ isVisible: false, selectedAssetId: ruwais.id });
    expect(map.flyTo).not.toHaveBeenCalled();
    // The highlight is still applied so it is right when the map reappears.
    expect(map.getLayer("refineries-selected-layer")!.filter).toEqual(["==", ["get", "id"], ruwais.id]);

    rerender({ isVisible: true, selectedAssetId: ruwais.id });
    expect(map.flyTo).toHaveBeenCalledTimes(1);

    rerender({ isVisible: false, selectedAssetId: ruwais.id });
    rerender({ isVisible: true, selectedAssetId: ruwais.id });
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it("opens on the region and cannot be zoomed out or panned far beyond it", () => {
    const { map } = renderMap();

    expect(map.options.bounds).toEqual(REGION_BOUNDS);
    // jsdom gives the panel no size, so the limit is the one for a square panel.
    expect(map.options.maxBounds).toEqual(getMaxBounds(0, 0));
  });

  it("frames what a filter narrows to, and returns to the region when the filter clears", () => {
    const iraq = { bounds: [[39, 29], [48, 37]] as [[number, number], [number, number]], id: "IQ|" };
    const { map, rerender } = renderMap();

    expect(map.fitBounds).not.toHaveBeenCalled();

    rerender({ focus: iraq });
    expect(map.fitBounds).toHaveBeenLastCalledWith(iraq.bounds, expect.objectContaining({ maxZoom: 8 }));

    // Same filter, new object: no second move.
    rerender({ focus: { ...iraq } });
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    rerender({ focus: null });
    expect(map.fitBounds).toHaveBeenLastCalledWith(REGION_BOUNDS, expect.anything());
  });

  it("waits until the map is shown before framing a filter set from another view", () => {
    const iraq = { bounds: [[39, 29], [48, 37]] as [[number, number], [number, number]], id: "IQ|" };
    const { map, rerender } = renderMap({ isVisible: false });

    rerender({ focus: iraq, isVisible: false });
    expect(map.fitBounds).not.toHaveBeenCalled();

    rerender({ focus: iraq, isVisible: true });
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("returns to the opening view from RESET VIEW", async () => {
    const user = userEvent.setup();
    const { map } = renderMap();

    await user.click(screen.getByRole("button", { name: "RESET VIEW" }));

    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [25, 12],
        [63, 42]
      ],
      expect.anything()
    );
  });

  it("selects the asset under a click and clears the selection on an empty click", () => {
    const { map, props } = renderMap();

    map.renderedFeatures = [{ properties: { id: ghawar.id } }];
    act(() => map.emit("click", { point: { x: 10, y: 10 } }));
    expect(props.onSelectAsset).toHaveBeenCalledWith(ghawar);

    map.renderedFeatures = [];
    act(() => map.emit("click", { point: { x: 10, y: 10 } }));
    expect(props.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("shows a hover card naming the asset, its type and its energy, and removes it on mouse out", () => {
    const { map } = renderMap();

    map.renderedFeatures = [{ properties: { id: eastWest.id } }];
    act(() => map.emit("mousemove", { point: { x: 40, y: 60 } }));

    expect(screen.getByText(eastWest.name)).toBeInTheDocument();
    expect(screen.getByText("PIPELINE · CRUDE OIL")).toBeInTheDocument();
    expect(map.getCanvas().style.cursor).toBe("pointer");
    expect(map.getLayer("pipelines-hover-layer")!.filter).toEqual(["==", ["get", "id"], eastWest.id]);

    act(() => map.emit("mouseout"));

    expect(screen.queryByText(eastWest.name)).not.toBeInTheDocument();
    expect(map.getLayer("pipelines-hover-layer")!.filter).toEqual(["==", ["get", "id"], ""]);
  });

  it("does not reset the style on first render, and rebuilds icons and layers after a basemap swap", async () => {
    const user = userEvent.setup();
    const { map, props, rerender } = renderMap({ selectedAssetId: ruwais.id });

    expect(map.setStyle).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "SAT" }));
    expect(props.onSelectBasemap).toHaveBeenCalledWith("satellite");

    act(() => rerender({ basemapMode: "satellite", selectedAssetId: ruwais.id }));

    expect(map.setStyle).toHaveBeenCalledWith("mapbox://styles/mapbox/satellite-v9");
    expect(map.images.size).toBe(2);
    expect(features(map, "refineries")).toHaveLength(1);
    // Selection survives the swap.
    expect(map.getLayer("refineries-selected-layer")!.filter).toEqual(["==", ["get", "id"], ruwais.id]);
  });

  it("removes the map on unmount", () => {
    const { map, unmount } = renderMap();

    unmount();

    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});
