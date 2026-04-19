import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowsSankey } from "./FlowsSankey";
import type { FlowSnapshot } from "../../types/Flows";

function snapshot(): FlowSnapshot {
  return {
    asOf: "2026-03-31",
    monthLabel: "Q1 2026",
    cadence: "MONTHLY",
    classification: "CURATED",
    source: "Test",
    origins: [
      { id: "SA", label: "Saudi Arabia" },
      { id: "IQ", label: "Iraq" }
    ],
    chokepoints: [{ id: "chokepoint-hormuz", label: "Strait of Hormuz" }],
    destinations: [
      { id: "CN", label: "China" },
      { id: "IN", label: "India" }
    ],
    legs: [
      { origin: "SA", chokepoint: "chokepoint-hormuz", destination: "CN", mbpd: 2.0 },
      { origin: "SA", chokepoint: "chokepoint-hormuz", destination: "IN", mbpd: 1.0 },
      { origin: "IQ", chokepoint: "chokepoint-hormuz", destination: "IN", mbpd: 1.5 }
    ]
  };
}

describe("FlowsSankey", () => {
  it("renders nodes for all three columns", () => {
    const { container } = render(<FlowsSankey snapshot={snapshot()} />);
    expect(screen.getByText("Saudi Arabia")).toBeDefined();
    expect(screen.getByText("Strait of Hormuz")).toBeDefined();
    expect(screen.getByText("China")).toBeDefined();
    const rects = container.querySelectorAll("rect");
    // 2 origins + 1 chokepoint + 2 destinations = 5 node rectangles
    expect(rects.length).toBe(5);
  });

  it("renders one ribbon pair per leg (2 paths per leg)", () => {
    const { container } = render(<FlowsSankey snapshot={snapshot()} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(3 * 2);
  });

  it("shows an empty state when the snapshot has no legs", () => {
    const emptySnap = { ...snapshot(), legs: [] };
    render(<FlowsSankey snapshot={emptySnap} />);
    expect(screen.getByText("NO FLOW DATA")).toBeDefined();
  });
});
