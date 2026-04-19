import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowsPage } from "./FlowsPage";
import type { FlowSnapshot } from "../types/Flows";

function snapshot(): FlowSnapshot {
  return {
    asOf: "2026-03-31",
    monthLabel: "Q1 2026",
    cadence: "MONTHLY",
    classification: "CURATED",
    source: "Test Curated",
    origins: [{ id: "SA", label: "Saudi Arabia" }],
    chokepoints: [{ id: "chokepoint-hormuz", label: "Strait of Hormuz" }],
    destinations: [{ id: "CN", label: "China" }],
    legs: [
      { origin: "SA", chokepoint: "chokepoint-hormuz", destination: "CN", mbpd: 2.0 }
    ]
  };
}

describe("FlowsPage", () => {
  it("renders a loading state when snapshot is null", () => {
    render(<FlowsPage snapshot={null} />);
    expect(screen.getByText("LOADING FLOWS…")).toBeDefined();
  });

  it("renders the Sankey + chokepoint board + destination mix panels", () => {
    render(<FlowsPage snapshot={snapshot()} />);
    expect(screen.getByText("CRUDE FLOWS · SANKEY")).toBeDefined();
    expect(screen.getByText("CHOKEPOINT BOARD")).toBeDefined();
    expect(screen.getByText("DESTINATION MIX")).toBeDefined();
  });

  it("shows the total mbpd in the sankey header", () => {
    render(<FlowsPage snapshot={snapshot()} />);
    expect(screen.getByText(/TOTAL 2\.0 MBPD/)).toBeDefined();
  });
});
