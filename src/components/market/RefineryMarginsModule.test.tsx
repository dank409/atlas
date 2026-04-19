import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RefineryMarginsModule } from "./RefineryMarginsModule";
import type { RefineryMarginSnapshot } from "../../types/RefineryMargins";

function snapshot(): RefineryMarginSnapshot {
  return {
    asOf: "2026-04-12",
    cadence: "WEEKLY",
    classification: "CURATED",
    source: "Platts / OilPrice curated",
    margins: [
      {
        label: "Singapore 3-2-1",
        valueUsdBbl: 12.44,
        change: -0.31,
        region: "Asia",
        source: "Platts"
      },
      {
        label: "RBOB Gasoline",
        valueUsdBbl: 24.18,
        change: 0.22,
        region: "US Atlantic",
        source: "NYMEX"
      }
    ]
  };
}

describe("RefineryMarginsModule", () => {
  it("renders the empty state when snapshot is null", () => {
    render(<RefineryMarginsModule snapshot={null} />);
    expect(screen.getByText("NO MARGIN DATA")).toBeDefined();
  });

  it("renders each margin row with signed change", () => {
    render(<RefineryMarginsModule snapshot={snapshot()} />);
    expect(screen.getByText("Singapore 3-2-1")).toBeDefined();
    expect(screen.getByText("12.44")).toBeDefined();
    expect(screen.getByText("-0.31")).toBeDefined();
    expect(screen.getByText("RBOB Gasoline")).toBeDefined();
    expect(screen.getByText("+0.22")).toBeDefined();
  });

  it("includes the asOf date in the panel badge", () => {
    render(<RefineryMarginsModule snapshot={snapshot()} />);
    expect(screen.getByText(/AS OF 2026-04-12/)).toBeDefined();
  });
});
