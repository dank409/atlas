import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermCurveModule } from "./TermCurveModule";
import type { IceBrentSettlementSnapshot } from "../../types/IceSettlements";
import type { BrentTimespreadSnapshot } from "../../types/Market";

function makeStrip(): IceBrentSettlementSnapshot {
  return {
    asOf: "2026-04-13",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "ICE",
    strip: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      contractCode: `BRN-M${i + 1}`,
      priceUsd: 85 - i * 0.3
    }))
  };
}

function makeTimespreads(structure: "BACKWARDATION" | "CONTANGO" | "FLAT"): BrentTimespreadSnapshot {
  return {
    asOf: "2026-04-13",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "ICE",
    m1MinusM2: 0.42,
    m1MinusM6: 2.14,
    m1MinusM12: 4.50,
    structure
  };
}

describe("TermCurveModule", () => {
  it("renders empty state when snapshot is null", () => {
    render(<TermCurveModule snapshot={null} timespreads={null} />);
    expect(screen.getByText("NO SETTLEMENT DATA")).toBeDefined();
  });

  it("renders 12 points for a full strip", () => {
    const { container } = render(
      <TermCurveModule snapshot={makeStrip()} timespreads={null} />
    );
    const dots = container.querySelectorAll("circle");
    expect(dots.length).toBe(12);
  });

  it("shows the structure label when timespreads are present", () => {
    render(
      <TermCurveModule snapshot={makeStrip()} timespreads={makeTimespreads("BACKWARDATION")} />
    );
    expect(screen.getByText("BACKWARDATION")).toBeDefined();
  });

  it("renders the min-max range footer from the strip prices", () => {
    render(<TermCurveModule snapshot={makeStrip()} timespreads={null} />);
    // Max is 85.00, min is 85 - 0.3*11 = 81.70
    expect(screen.getByText("81.70 — 85.00")).toBeDefined();
  });
});
