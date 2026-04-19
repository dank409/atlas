import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const workspaceData = {
  catalog: [
    {
      id: "refineries",
      title: "REFINERIES",
      source: "Global Energy Monitor",
      frequency: "Quarterly",
      coverage: "Middle East",
      notes: "Operational and outage-aware refinery seed coverage",
      status: "available",
      recordCount: 2,
      defaultActive: true
    },
    {
      id: "pipelines",
      title: "PIPELINES",
      source: "Global Energy Monitor",
      frequency: "Quarterly",
      coverage: "Middle East",
      notes: "Curated route geometries",
      status: "available",
      recordCount: 2,
      defaultActive: true
    },
    {
      id: "chokepoints",
      title: "CHOKEPOINTS",
      source: "EIA + curated reference",
      frequency: "Periodic",
      coverage: "Middle East",
      notes: "Strategic chokepoints",
      status: "available",
      recordCount: 1,
      defaultActive: true
    }
  ],
  assets: [
    {
      assetKind: "refinery",
      datasetId: "refineries",
      id: "refinery-ruwais",
      name: "Ruwais Refinery",
      country: "AE",
      countryName: "United Arab Emirates",
      owner: "Abu Dhabi National Oil Co",
      operator: "ADNOC Refining",
      status: "operational",
      capacity_bpd: 837000,
      capacityUnit: "bpd",
      lat: 24.1108,
      lon: 54.0894,
      _metadata: {
        source: "Approved refinery seed",
        downloadDate: "2026-04-13"
      }
    },
    {
      assetKind: "chokepoint",
      datasetId: "chokepoints",
      id: "chokepoint-hormuz",
      name: "Strait of Hormuz",
      country: "ME",
      countryName: "Middle East",
      status: "strategic",
      transitVolume_mbpd: 20.5,
      geometry: {
        type: "LineString",
        coordinates: [
          [56.0, 26.7],
          [56.5, 26.3]
        ]
      },
      _metadata: {
        source: "Approved chokepoint seed",
        downloadDate: "2026-04-13"
      }
    }
  ],
  companiesById: {},
  countriesByCode: {},
  exposureByTargetId: {}
};

vi.mock("./components/map/MapView", () => ({
  MapView: ({
    activeDatasetIds,
    selectedAssetId,
    visibleAssets
  }: {
    activeDatasetIds: string[];
    selectedAssetId: string | null;
    visibleAssets: Array<{ id: string; name: string }>;
  }) => (
    <div>
      <div>MAP VIEW ACTIVE: {activeDatasetIds.length} DATASETS / {visibleAssets.length} ASSETS</div>
      <div>MAP SELECTED: {selectedAssetId ?? "NONE"}</div>
    </div>
  ),
  BASEMAP_MODE_LABELS: { dark: "DARK", satellite: "SAT", firms: "FIRMS" }
}));

vi.mock("./hooks/useMapWorkspaceData", () => ({
  useMapWorkspaceData: () => ({
    ...workspaceData,
    error: null,
    isLoading: false,
    firmsBaselineByAssetId: {}
  })
}));

vi.mock("./hooks/useCrudePrices", () => ({
  useCrudePrices: () => ({
    error: null,
    isLoading: false,
    snapshot: null,
    dmeOmanSnapshot: null,
    murbanSnapshot: null,
    spreadHistory: null,
    summary: null
  })
}));

vi.mock("./hooks/useIceSettlements", () => ({
  useIceSettlements: () => ({
    error: null,
    isLoading: false,
    snapshot: null,
    timespreads: null
  })
}));

vi.mock("./hooks/useOutageEvents", () => ({
  useOutageEvents: () => ({ error: null, isLoading: false, snapshot: null })
}));

vi.mock("./hooks/useBrentHistorical", () => ({
  useBrentHistorical: () => ({ error: null, isLoading: false, snapshot: null })
}));

vi.mock("./hooks/useFirms", () => ({
  useFirms: () => ({ error: null, isLoading: false, snapshot: null })
}));

import { App } from "./App";

describe("App shell — new view router", () => {
  it("renders the top-nav tab strip with all 11 views", async () => {
    render(<App />);
    for (const label of [
      "MAP",
      "MARKETS",
      "FLOWS",
      "CHOKES",
      "EVENTS",
      "MODELS",
      "AIS",
      "NOTES",
      "REFERENCE",
      "ABOUT",
      "DATA"
    ]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it("mounts the map workspace on initial load", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/MAP VIEW ACTIVE/)).toBeInTheDocument()
    );
  });

  it("routes to MARKETS when the MARKETS tab is clicked", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("MARKETS"));
    // Markets view renders the CRUDE · SPOT module (or its empty-state text).
    await waitFor(() =>
      expect(screen.getByText("CRUDE · SPOT")).toBeInTheDocument()
    );
  });

  it("routes to EVENTS view and offers a feed/swimlane toggle", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("EVENTS"));
    expect(await screen.findByText("FEED")).toBeInTheDocument();
    expect(screen.getByText("SWIMLANE")).toBeInTheDocument();
  });

  it("routes to MODELS view and shows the scenario stress-test panel", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("MODELS"));
    expect(await screen.findByText("SCENARIO INPUTS")).toBeInTheDocument();
    expect(screen.getByText("HORMUZ DISRUPTION")).toBeInTheDocument();
  });

  it("routes to DATA and lists source feeds", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("DATA"));
    expect(await screen.findByText("DATA · SOURCES")).toBeInTheDocument();
  });

  it("routes to ABOUT and shows the project thesis", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("ABOUT"));
    expect(await screen.findByText("ATLAS / ABOUT")).toBeInTheDocument();
  });

  it("renders the LeftRail with grouped layer sections and region chips", async () => {
    render(<App />);
    expect(await screen.findByText("LAYERS · FILTERS")).toBeInTheDocument();
    expect(screen.getByText("PIPELINES")).toBeInTheDocument();
    expect(screen.getByText("UPSTREAM")).toBeInTheDocument();
    expect(screen.getByText("DOWNSTREAM")).toBeInTheDocument();
    expect(screen.getByText("GEOPOLITICAL")).toBeInTheDocument();
    expect(screen.getByText("MENA")).toBeInTheDocument();
    expect(screen.getByText("RED SEA")).toBeInTheDocument();
  });

  it("resolves a command-bar view command and switches the active view", async () => {
    render(<App />);
    const input = screen.getByLabelText("Command or search");
    fireEvent.change(input, { target: { value: "chokes" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() =>
      expect(
        screen.getAllByText("CHOKEPOINTS", { exact: false }).length
      ).toBeGreaterThan(0)
    );
  });

  it("renders the timeline scrubber + status bar in the footer", async () => {
    render(<App />);
    // When the Brent historical snapshot is null in the mock, the
    // scrubber renders its loading empty state. Either form proves it's
    // mounted in the footer.
    expect(
      await screen.findByText(/BRENT HISTORICAL · LOADING|TIMELINE/)
    ).toBeInTheDocument();
    expect(screen.getByText(/REGION: MIDDLE EAST/)).toBeInTheDocument();
  });

  it("no longer shows the legacy focus-shortcut section", async () => {
    render(<App />);
    // Shortcut affordances were removed in the polish pass — the
    // LeftRail should no longer contain any of the legacy labels.
    await screen.findByText("LAYERS · FILTERS");
    expect(screen.queryByText("Focus Hormuz")).toBeNull();
    expect(screen.queryByText("Focus Red Sea")).toBeNull();
    expect(screen.queryByText("Focus Eastern Prov.")).toBeNull();
  });
});

// Silence unused-import warning for within() when this file is pared
// down further in future — it stays imported because follow-up tests
// will scope queries into specific panels.
void within;
