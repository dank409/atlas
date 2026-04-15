import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatasetCatalogPanel } from "./DatasetCatalogPanel";
import type { DatasetCatalogEntry } from "../../types/Infrastructure";

const catalog: DatasetCatalogEntry[] = [
  {
    id: "refineries",
    title: "REFINERIES",
    status: "available",
    defaultActive: true,
    recordCount: 42,
    source: "OGIM",
    frequency: "QUARTERLY",
    coverage: "GULF",
    notes: "Core refinery set."
  },
  {
    id: "pipelines",
    title: "PIPELINES",
    status: "available",
    defaultActive: false,
    recordCount: 12,
    source: "GEM",
    frequency: "QUARTERLY",
    coverage: "REGION",
    notes: "Crude and product pipelines."
  },
  {
    id: "fields",
    title: "FIELDS",
    status: "curating",
    defaultActive: false,
    recordCount: 0,
    source: "EIA",
    frequency: "MONTHLY",
    coverage: "REGION",
    notes: "Curation in progress."
  }
];

describe("DatasetCatalogPanel", () => {
  it("renders a card for every catalog entry and shows active count badge", () => {
    render(
      <DatasetCatalogPanel
        activeDatasetIds={["refineries"]}
        catalog={catalog}
        focusedDatasetId="refineries"
        onFocusDataset={vi.fn()}
        onToggleDataset={vi.fn()}
      />
    );

    expect(screen.getByText("REFINERIES")).toBeInTheDocument();
    expect(screen.getByText("PIPELINES")).toBeInTheDocument();
    expect(screen.getByText("FIELDS")).toBeInTheDocument();
    expect(screen.getByText("1 ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("labels active datasets ON and inactive available datasets OFF", () => {
    render(
      <DatasetCatalogPanel
        activeDatasetIds={["refineries"]}
        catalog={catalog}
        focusedDatasetId="refineries"
        onFocusDataset={vi.fn()}
        onToggleDataset={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "ON" })).toBeInTheDocument();
    // One OFF button for PIPELINES. FIELDS is also OFF but its toggle is disabled.
    expect(screen.getAllByRole("button", { name: "OFF" }).length).toBeGreaterThanOrEqual(1);
  });

  it("invokes onToggleDataset when an ON/OFF button is clicked", () => {
    const onToggleDataset = vi.fn();
    render(
      <DatasetCatalogPanel
        activeDatasetIds={["refineries"]}
        catalog={catalog}
        focusedDatasetId="refineries"
        onFocusDataset={vi.fn()}
        onToggleDataset={onToggleDataset}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "ON" }));
    expect(onToggleDataset).toHaveBeenCalledWith("refineries");
  });

  it("invokes onFocusDataset when a dataset title button is clicked", () => {
    const onFocusDataset = vi.fn();
    render(
      <DatasetCatalogPanel
        activeDatasetIds={["refineries"]}
        catalog={catalog}
        focusedDatasetId="refineries"
        onFocusDataset={onFocusDataset}
        onToggleDataset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /PIPELINES/ }));
    expect(onFocusDataset).toHaveBeenCalledWith("pipelines");
  });

  it("disables buttons for datasets that are still being curated", () => {
    render(
      <DatasetCatalogPanel
        activeDatasetIds={[]}
        catalog={catalog}
        focusedDatasetId="refineries"
        onFocusDataset={vi.fn()}
        onToggleDataset={vi.fn()}
      />
    );

    // FIELDS is status: curating — its focus button should be disabled.
    const fieldsButton = screen.getByRole("button", { name: /FIELDS/ });
    expect(fieldsButton).toBeDisabled();
  });
});
