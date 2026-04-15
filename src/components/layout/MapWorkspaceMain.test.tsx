import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// MapView pulls in mapbox-gl + the full map layer pipeline. We stub the
// lazily-imported module so MapWorkspaceMain tests can exercise the shell
// wiring (map region, grid region, badge count) without spinning up the map.
vi.mock("../map/MapView", () => ({
  MapView: (props: { activeDatasetIds: string[] }) => (
    <div data-testid="map-view-stub">MAP · {props.activeDatasetIds.join(",")}</div>
  )
}));

import { MapWorkspaceMain } from "./MapWorkspaceMain";
import { IDLE_SCENARIO_VISUAL_STATE } from "../../utils/scenarioMapStyles";
import type { AssetGridRow, RefineryAsset } from "../../types/Infrastructure";

const refineryAssets: RefineryAsset[] = [
  {
    assetKind: "refinery",
    datasetId: "refineries",
    id: "refinery-ruwais",
    name: "Ruwais Refinery",
    country: "AE",
    countryName: "United Arab Emirates",
    owner: "ADNOC",
    operator: "ADNOC Refining",
    status: "operational",
    capacity_bpd: 837000,
    capacityUnit: "bpd",
    lat: 24.1108,
    lon: 54.0894,
    _metadata: { source: "OGIM", downloadDate: "2026-04-14" }
  },
  {
    assetKind: "refinery",
    datasetId: "refineries",
    id: "refinery-jubail",
    name: "Jubail Refinery",
    country: "SA",
    countryName: "Saudi Arabia",
    owner: "Saudi Aramco",
    operator: "Saudi Aramco",
    status: "operational",
    capacity_bpd: 400000,
    capacityUnit: "bpd",
    lat: 27.0174,
    lon: 49.6651,
    _metadata: { source: "OGIM", downloadDate: "2026-04-14" }
  }
];

const gridRows: AssetGridRow[] = refineryAssets.map((asset) => ({
  asset,
  name: asset.name,
  datasetLabel: "REFINERIES",
  countryName: asset.countryName,
  status: asset.status,
  primaryMetric: `${asset.capacity_bpd} bpd`,
  secondaryMetric: asset.operator,
  reference: asset._metadata.source
}));

describe("MapWorkspaceMain", () => {
  it("renders the map region (suspended MapView) and the asset grid panel", async () => {
    render(
      <MapWorkspaceMain
        activeDatasetIds={["refineries"]}
        gridDatasetId="refineries"
        gridRows={gridRows}
        hasError={false}
        basemapMode="dark"
        latestUpdate="2026-04-14"
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        scenarioState={IDLE_SCENARIO_VISUAL_STATE}
        selectedAssetId={null}
        visibleAssets={[]}
      />
    );

    // Grid panel is synchronous — header + badge render immediately.
    expect(screen.getByText("ASSET GRID")).toBeInTheDocument();
    expect(screen.getByText("2 VISIBLE")).toBeInTheDocument();

    // MapView is lazy-loaded via React.lazy/Suspense — wait for it.
    await waitFor(() => {
      expect(screen.getByTestId("map-view-stub")).toBeInTheDocument();
    });
    expect(screen.getByTestId("map-view-stub")).toHaveTextContent("MAP · refineries");
  });

  it("renders the grid row names so users can see the underlying assets", async () => {
    render(
      <MapWorkspaceMain
        activeDatasetIds={["refineries"]}
        gridDatasetId="refineries"
        gridRows={gridRows}
        hasError={false}
        basemapMode="dark"
        latestUpdate="2026-04-14"
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        scenarioState={IDLE_SCENARIO_VISUAL_STATE}
        selectedAssetId={null}
        visibleAssets={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("map-view-stub")).toBeInTheDocument();
    });
    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();
    expect(screen.getByText("Jubail Refinery")).toBeInTheDocument();
  });

  it("shows a zero badge when the grid has no rows", async () => {
    render(
      <MapWorkspaceMain
        activeDatasetIds={[]}
        gridDatasetId={null}
        gridRows={[]}
        hasError={false}
        basemapMode="dark"
        latestUpdate="--"
        onClearSelection={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        scenarioState={IDLE_SCENARIO_VISUAL_STATE}
        selectedAssetId={null}
        visibleAssets={[]}
      />
    );

    expect(screen.getByText("0 VISIBLE")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("map-view-stub")).toBeInTheDocument();
    });
  });
});
