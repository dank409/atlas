import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferencePage } from "./ReferencePage";
import type { RefineryAsset } from "../types/Infrastructure";

function refinery(id: string, name: string, country: string, capacity: number): RefineryAsset {
  return {
    assetKind: "refinery",
    datasetId: "refineries",
    id,
    name,
    country,
    countryName: country,
    owner: "test",
    operator: "test",
    status: "operational",
    capacity_bpd: capacity,
    capacityUnit: "bpd",
    lat: 0,
    lon: 0,
    _metadata: { source: "test", downloadDate: "2026-04-19" }
  };
}

describe("ReferencePage", () => {
  const refineries = [refinery("r1", "Ruwais", "AE", 837000)];

  it("renders the sub-nav tabs", () => {
    render(
      <ReferencePage
        onInspectRefinery={vi.fn()}
        refineries={refineries}
      />
    );
    expect(screen.getByText("REFINERIES")).toBeDefined();
    expect(screen.getByText("VOYAGES")).toBeDefined();
    expect(screen.getByText("NEWS")).toBeDefined();
    expect(screen.getByText("GLOSSARY")).toBeDefined();
  });

  it("defaults to the refineries sub-view with the reference table", () => {
    render(
      <ReferencePage
        onInspectRefinery={vi.fn()}
        refineries={refineries}
      />
    );
    expect(screen.getByText("Ruwais")).toBeDefined();
  });

  it("switches to the glossary sub-view on click", () => {
    render(
      <ReferencePage
        onInspectRefinery={vi.fn()}
        refineries={refineries}
      />
    );
    fireEvent.click(screen.getByText("GLOSSARY"));
    expect(screen.getByText("OIL-MARKET GLOSSARY")).toBeDefined();
    expect(screen.getByText("Backwardation")).toBeDefined();
  });

  it("shows the AWAITING FEED placeholder on VOYAGES + NEWS", () => {
    render(
      <ReferencePage
        onInspectRefinery={vi.fn()}
        refineries={refineries}
      />
    );
    fireEvent.click(screen.getByText("VOYAGES"));
    expect(screen.getByText("VOYAGES", { selector: "span" })).toBeDefined();
    fireEvent.click(screen.getByText("NEWS"));
    expect(screen.getByText("NEWS", { selector: "span" })).toBeDefined();
  });
});
