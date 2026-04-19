import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RefineryReferenceTable } from "./RefineryReferenceTable";
import type { RefineryAsset } from "../../types/Infrastructure";

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

describe("RefineryReferenceTable", () => {
  const refineries = [
    refinery("r1", "Ruwais", "AE", 837000),
    refinery("r2", "Ras Tanura", "SA", 550000),
    refinery("r3", "Abadan", "IR", 400000)
  ];

  it("renders all refineries with a summary row", () => {
    render(
      <RefineryReferenceTable
        onInspectRefinery={vi.fn()}
        refineries={refineries}
      />
    );
    expect(screen.getByText("MIDDLE EAST REFINERY REFERENCE")).toBeDefined();
    expect(screen.getByText(/3 SITES/)).toBeDefined();
    expect(screen.getByText("Ruwais")).toBeDefined();
    expect(screen.getByText("Ras Tanura")).toBeDefined();
    expect(screen.getByText("Abadan")).toBeDefined();
  });

  it("fires onInspectRefinery when a row is clicked", () => {
    const onInspectRefinery = vi.fn();
    render(
      <RefineryReferenceTable
        onInspectRefinery={onInspectRefinery}
        refineries={refineries}
      />
    );
    fireEvent.click(screen.getByText("Ruwais"));
    expect(onInspectRefinery).toHaveBeenCalledTimes(1);
    expect(onInspectRefinery).toHaveBeenCalledWith(refineries[0]);
  });

  it("sorts descending by capacity by default (Ruwais first)", () => {
    const { container } = render(
      <RefineryReferenceTable
        onInspectRefinery={vi.fn()}
        refineries={refineries}
      />
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Ruwais");
    expect(rows[1].textContent).toContain("Ras Tanura");
    expect(rows[2].textContent).toContain("Abadan");
  });
});
