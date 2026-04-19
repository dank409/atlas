import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpreadsModule } from "./SpreadsModule";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary
} from "../../types/Market";

function makeSummary(): CrudeMarketSummary {
  const quote = (value: number) => ({
    name: "BRENT" as const,
    asOf: "2026-04-13",
    cadence: "EOD" as const,
    value,
    change: 0,
    changePct: 0,
    classification: "OBSERVED" as const,
    source: "EIA"
  });
  return {
    asOf: "2026-04-13",
    brent: quote(84.72),
    wti: quote(80.94),
    brentWtiSpread: 3.78,
    brentDmeOmanSpread: 1.31,
    cadence: "EOD",
    classification: "OBSERVED",
    source: "EIA"
  };
}

function makeTimespreads(): BrentTimespreadSnapshot {
  return {
    asOf: "2026-04-13",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "ICE",
    m1MinusM2: 0.42,
    m1MinusM6: 2.14,
    m1MinusM12: 4.50,
    structure: "BACKWARDATION"
  };
}

describe("SpreadsModule", () => {
  it("renders benchmark spreads with signed values", () => {
    render(<SpreadsModule summary={makeSummary()} timespreads={null} />);
    expect(screen.getByText("BRENT · WTI")).toBeDefined();
    expect(screen.getByText("+3.78")).toBeDefined();
    expect(screen.getByText("+1.31")).toBeDefined();
  });

  it("omits calendar section when timespreads are null", () => {
    render(<SpreadsModule summary={makeSummary()} timespreads={null} />);
    expect(screen.queryByText("CALENDAR")).toBeNull();
  });

  it("renders calendar section with structure label when timespreads present", () => {
    render(<SpreadsModule summary={makeSummary()} timespreads={makeTimespreads()} />);
    expect(screen.getByText("CALENDAR")).toBeDefined();
    expect(screen.getByText("BRENT M1 · M2")).toBeDefined();
    expect(screen.getByText("BACKWARDATION")).toBeDefined();
  });

  it("shows dashes when summary is null", () => {
    const { container } = render(<SpreadsModule summary={null} timespreads={null} />);
    const dashes = Array.from(container.querySelectorAll("span")).filter(
      (el) => el.textContent === "--"
    );
    expect(dashes.length).toBe(2);
  });
});
