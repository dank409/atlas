import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapContentPanel } from "./MapContentPanel";
import type { DatasetFiltersById, FieldAsset } from "../../types/Infrastructure";

const filtersByDataset: DatasetFiltersById = {
  chokepoints: { country: "ALL", status: "ALL", text: "" },
  fields: { country: "ALL", status: "ALL", text: "" },
  pipelines: { country: "ALL", hydrocarbon: "ALL", status: "ALL", text: "" },
  refineries: { country: "ALL", operator: "ALL", status: "ALL", text: "" },
  terminals: { country: "ALL", status: "ALL", text: "" }
};

describe("MapContentPanel", () => {
  it("shows terminal-style filter pickers for fields when data is available", () => {
    const fieldAsset: FieldAsset = {
      assetKind: "field",
      datasetId: "fields",
      id: "field-abqaiq",
      name: "Abqaiq Oil Field",
      country: "SA",
      countryName: "Saudi Arabia",
      status: "operating",
      operator: "Saudi Arabian Oil Company",
      basin: "Ghawar",
      fieldType: "oil",
      lat: 26.1687,
      lon: 49.7841,
      linkedContext: {
        countryCode: "SA"
      },
      _metadata: {
        downloadDate: "2026-03",
        source: "Global Energy Monitor - Global Oil and Gas Extraction Tracker"
      }
    };
    const onFilterChange = vi.fn();

    render(
      <MapContentPanel
        activeDatasetIds={["fields"]}
        assets={[fieldAsset]}
        filtersByDataset={filtersByDataset}
        focusedDataset={{
          id: "fields",
          title: "OIL & GAS FIELDS",
          source: "Global Energy Monitor",
          frequency: "Quarterly",
          coverage: "Middle East",
          notes: "Field centroids and production context from GOGET.",
          status: "available",
          recordCount: 1,
          defaultActive: false
        }}
        onFilterChange={onFilterChange}
        onToggleDataset={vi.fn()}
      />
    );

    expect(screen.queryByText(/CURATED IMPORT PENDING/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Text filter")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Country filter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status filter" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Country filter" }));
    expect(screen.getByRole("listbox", { name: "Country filter" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Saudi Arabia" }));
    expect(onFilterChange).toHaveBeenCalledWith("fields", "country", "SA");
    expect(screen.queryByRole("listbox", { name: "Country filter" })).not.toBeInTheDocument();

    expect(screen.getByText("LEGEND")).toBeInTheDocument();
  });
});
