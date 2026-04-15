import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetGridTable } from "./AssetGridTable";
import type { AssetGridRow, PipelineAsset } from "../../types/Infrastructure";

const pipelineAssets: PipelineAsset[] = [
  {
    assetKind: "pipeline",
    datasetId: "pipelines",
    id: "pipeline-east-west",
    name: "East-West Crude Oil Pipeline",
    country: "SA",
    countryName: "Saudi Arabia",
    countries: ["SA"],
    owner: "Saudi Aramco",
    operator: "Saudi Aramco",
    status: "operating",
    hydrocarbon: "crude_oil",
    capacity_boed: 5_000_000,
    diameter_inches: 56,
    length_km: 1200,
    startPoint: "Abqaiq",
    endPoint: "Yanbu",
    geometryConfidence: "high",
    geometry: {
      type: "LineString",
      coordinates: [
        [49.6778, 25.9344],
        [38.0617, 24.0889]
      ]
    },
    linkedContext: {
      companyId: "saudi-aramco",
      countryCode: "SA",
      ticker: "ARAMCO AB Equity"
    },
    _metadata: {
      source: "Approved pipeline seed",
      downloadDate: "2026-04-13"
    }
  },
  {
    assetKind: "pipeline",
    datasetId: "pipelines",
    id: "pipeline-marjan",
    name: "Marjan Oil Pipeline",
    country: "SA",
    countryName: "Saudi Arabia",
    countries: ["SA"],
    owner: "Saudi Aramco",
    operator: "Saudi Aramco",
    status: "construction",
    hydrocarbon: "crude_oil",
    capacity_boed: 300_000,
    diameter_inches: 36,
    length_km: 100,
    startPoint: "Marjan",
    endPoint: "Tanajib",
    geometryConfidence: "high",
    geometry: {
      type: "LineString",
      coordinates: [
        [49.572, 27.981],
        [49.658, 27.921]
      ]
    },
    linkedContext: {
      companyId: "saudi-aramco",
      countryCode: "SA",
      ticker: "ARAMCO AB Equity"
    },
    _metadata: {
      source: "Approved pipeline seed",
      downloadDate: "2026-04-13"
    }
  }
];

const pipelineRows: AssetGridRow[] = pipelineAssets.map((asset) => ({
  asset,
  name: asset.name,
  datasetLabel: "CRUDE / GAS PIPELINES",
  countryName: asset.countryName,
  status: asset.status,
  primaryMetric: asset.capacity_boed ? `${asset.capacity_boed} BOE/D` : "--",
  secondaryMetric: asset.length_km ? `${asset.length_km} km` : "--",
  reference: asset.linkedContext?.ticker ?? asset._metadata.source
}));

describe("AssetGridTable", () => {
  it("renders the 4-column essentials set (name, country, capacity, status) for pipelines", () => {
    // Columns were pared down from 7 → 4: metadata like HYDROCARBON,
    // OWNER, LENGTH, REFERENCE moved into the inspect overlay that
    // opens on row click. The grid's job is now "scan at a glance",
    // not "display every field".
    render(
      <AssetGridTable
        activeDatasetCount={1}
        latestUpdate="2026-04-13"
        onSelectAsset={() => {}}
        rows={pipelineRows}
        selectedAssetId={null}
      />
    );

    expect(screen.getByRole("button", { name: "SORT BY NAME" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY COUNTRY" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY CAPACITY" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY STATUS" })).toBeInTheDocument();

    // De-scoped columns now live on the overlay, not the grid.
    expect(screen.queryByRole("button", { name: "SORT BY HYDROCARBON" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SORT BY OWNER" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SORT BY LENGTH" })).not.toBeInTheDocument();
  });

  it("sorts pipeline rows by capacity when the header is clicked", () => {
    render(
      <AssetGridTable
        activeDatasetCount={1}
        latestUpdate="2026-04-13"
        onSelectAsset={() => {}}
        rows={pipelineRows}
        selectedAssetId={null}
      />
    );

    // Default sort for pipelines is capacity desc, so the 5 MBOED
    // East-West row leads. tanstack's 3-state cycle (desc → cleared
    // → asc → desc …) means two clicks flip us into ascending, at
    // which point the 300k Marjan row takes over.
    const bodyRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows[0]).toHaveTextContent("East-West Crude Oil Pipeline");

    fireEvent.click(screen.getByRole("button", { name: /sort by capacity/i }));
    fireEvent.click(screen.getByRole("button", { name: /sort by capacity/i }));

    const resortedRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(resortedRows[0]).toHaveTextContent("Marjan Oil Pipeline");
  });

  it("routes row clicks through onInspectAsset when provided, not onSelectAsset", () => {
    const onInspect = vi.fn();
    const onSelect = vi.fn();
    render(
      <AssetGridTable
        activeDatasetCount={1}
        latestUpdate="2026-04-13"
        onInspectAsset={onInspect}
        onSelectAsset={onSelect}
        rows={pipelineRows}
        selectedAssetId={null}
      />
    );

    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    fireEvent.click(firstRow);

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
