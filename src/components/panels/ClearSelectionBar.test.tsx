import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClearSelectionBar } from "./ClearSelectionBar";
import type { InfrastructureAsset } from "../../types/Infrastructure";

const asset: InfrastructureAsset = {
  assetKind: "refinery",
  datasetId: "refineries",
  id: "refinery-ruwais",
  name: "Ruwais Refinery",
  country: "AE",
  countryName: "United Arab Emirates",
  owner: "Abu Dhabi National Oil Company",
  operator: "ADNOC Refining",
  status: "unknown",
  capacity_bpd: 837000,
  capacityUnit: "bpd",
  lat: 24.1108,
  lon: 54.0894,
  _metadata: { source: "OGIM", downloadDate: "2026-04-14" }
};

describe("ClearSelectionBar", () => {
  it("renders the asset kind and name", () => {
    render(<ClearSelectionBar asset={asset} onClear={() => {}} />);
    expect(screen.getByText("REFINERY")).toBeInTheDocument();
    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();
  });

  it("emits onClear when the clear button is clicked", () => {
    const onClear = vi.fn();
    render(<ClearSelectionBar asset={asset} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: /Clear selection/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
