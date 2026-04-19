import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChokesPage } from "./ChokesPage";
import type { ChokepointAsset } from "../types/Infrastructure";
import type { WarRiskSnapshot } from "../types/WarRisk";

function makeWarRisk(): WarRiskSnapshot {
  return {
    asOf: "2026-02-25",
    cadence: "CURATED",
    classification: "CURATED",
    source: "Lloyd's JWC",
    chokepointListings: [
      {
        chokepointId: "chokepoint-hormuz",
        listed: true,
        listedSince: "2019-07",
        indicativeHmPct: { min: 0.05, max: 0.10 },
        notes: "Listed since 2019."
      }
    ]
  };
}

function choke(id: string, name: string, mbpd: number): ChokepointAsset {
  return {
    assetKind: "chokepoint",
    datasetId: "chokepoints",
    id,
    name,
    country: "ME",
    countryName: "Middle East",
    status: "strategic",
    transitVolume_mbpd: mbpd,
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1]
      ]
    },
    _metadata: { source: "test", downloadDate: "2026-04-19" }
  };
}

describe("ChokesPage", () => {
  const chokepoints = [
    choke("chokepoint-hormuz", "Strait of Hormuz", 20.5),
    choke("chokepoint-bab-el-mandeb", "Bab el-Mandeb", 8.2),
    choke("chokepoint-suez", "Suez Canal", 9.2)
  ];

  it("shows the list + empty-state when no chokepoints", () => {
    render(<ChokesPage chokepoints={[]} />);
    expect(screen.getByText("NO CHOKEPOINT DATA")).toBeDefined();
  });

  it("renders all chokepoints sorted by descending transit volume", () => {
    const { container } = render(<ChokesPage chokepoints={chokepoints} />);
    const listButtons = container.querySelectorAll("[class*='listRow']");
    // Length 3 (hormuz, suez, bab). First text should include HORMUZ.
    expect(listButtons.length).toBe(3);
    expect(listButtons[0].textContent).toContain("STRAIT OF HORMUZ");
  });

  it("displays the Hormuz detail pane with rerouting capacity bars", () => {
    render(<ChokesPage chokepoints={chokepoints} />);
    // "STRAIT OF HORMUZ" appears in both the list row and the detail
    // header — the test only cares that the detail pane's rerouting
    // bars render, which is Hormuz-exclusive content.
    expect(screen.getByText("Petroline (East-West)")).toBeDefined();
    expect(screen.getByText("ADCOP (Habshan → Fujairah)")).toBeDefined();
  });

  it("fires onSelectChokepoint when a chokepoint row is clicked", () => {
    const onSelectChokepoint = vi.fn();
    render(
      <ChokesPage chokepoints={chokepoints} onSelectChokepoint={onSelectChokepoint} />
    );
    fireEvent.click(screen.getByText("BAB EL-MANDEB"));
    expect(onSelectChokepoint).toHaveBeenCalledTimes(1);
  });

  it("falls back to a 'no published bypass routes' state for non-Hormuz", () => {
    render(<ChokesPage chokepoints={chokepoints} />);
    fireEvent.click(screen.getByText("SUEZ CANAL"));
    expect(screen.getByText(/NO PUBLISHED BYPASS ROUTES/)).toBeDefined();
  });

  it("renders the JWC war-risk row when warRisk is provided and Hormuz is selected", () => {
    render(<ChokesPage chokepoints={chokepoints} warRisk={makeWarRisk()} />);
    expect(screen.getByText("JWC LISTED")).toBeDefined();
    expect(screen.getByText(/INDICATIVE H&M 0\.05–0\.10%/)).toBeDefined();
  });

  it("shows a no-listing fallback for chokepoints absent from the JWC set", () => {
    render(<ChokesPage chokepoints={chokepoints} warRisk={makeWarRisk()} />);
    fireEvent.click(screen.getByText("SUEZ CANAL"));
    expect(screen.getByText(/No JWC listing on file/)).toBeDefined();
  });
});
