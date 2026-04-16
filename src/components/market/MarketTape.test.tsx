import type { BrentTimespreadSnapshot } from "../../types/Market";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketTape } from "./MarketTape";
import type { CrudeMarketSummary } from "../../types/Market";

const summary: CrudeMarketSummary = {
  asOf: "2026-04-14",
  cadence: "EOD",
  classification: "OBSERVED",
  source: "Gulf benchmarks (static)",
  brent: {
    name: "BRENT",
    value: 77.35,
    change: 0.25,
    changePct: 0.32,
    asOf: "2026-04-14",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "EIA"
  },
  wti: {
    name: "WTI",
    value: 73.42,
    change: -0.18,
    changePct: -0.24,
    asOf: "2026-04-14",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "EIA"
  },
  dmeOman: {
    name: "DME_OMAN",
    value: 76.31,
    change: 0.42,
    changePct: 0.55,
    asOf: "2026-04-14",
    cadence: "CURATED",
    classification: "CURATED",
    source: "DME"
  },
  murban: {
    name: "MURBAN",
    value: 77.07,
    change: 0.19,
    changePct: 0.25,
    asOf: "2026-04-14",
    cadence: "CURATED",
    classification: "CURATED",
    source: "IFAD"
  },
  brentWtiSpread: 3.93,
  brentDmeOmanSpread: 1.04
};

const timespreads: BrentTimespreadSnapshot = {
  asOf: "2026-04-14",
  cadence: "EOD",
  classification: "CURATED",
  source: "ICE Brent settlements",
  m1MinusM2: 1.55,
  m1MinusM6: 6.2,
  m1MinusM12: 10.25,
  structure: "BACKWARDATION"
};

describe("MarketTape", () => {
  it("renders loading state while data is in flight", () => {
    render(<MarketTape error={null} isLoading={true} summary={null} />);
    expect(screen.getByText("LOADING MACRO CONTEXT…")).toBeInTheDocument();
  });

  it("renders offline state on error", () => {
    render(<MarketTape error={new Error("boom")} isLoading={false} summary={null} />);
    expect(screen.getByText("MACRO DATA UNAVAILABLE")).toBeInTheDocument();
  });

  it("renders Brent, WTI, Brent-WTI, DME Oman, and prompt timespread tiles", () => {
    render(
      <MarketTape
        error={null}
        isLoading={false}
        summary={summary}
        timespreads={timespreads}
      />
    );

    expect(screen.getByText("MACRO")).toBeInTheDocument();

    expect(screen.getByText("BRENT")).toBeInTheDocument();
    expect(screen.getByText("$77.35")).toBeInTheDocument();

    expect(screen.getByText("WTI")).toBeInTheDocument();
    expect(screen.getByText("$73.42")).toBeInTheDocument();

    expect(screen.getByText("BRENT-WTI")).toBeInTheDocument();
    expect(screen.getByText("+3.93")).toBeInTheDocument();

    expect(screen.getByText("DME OMAN")).toBeInTheDocument();
    expect(screen.getByText("$76.31")).toBeInTheDocument();

    expect(screen.getByText("BRENT M1-M2")).toBeInTheDocument();
    expect(screen.getByText("+1.55")).toBeInTheDocument();
    expect(screen.getByText(/BACKWARDATION/)).toBeInTheDocument();
  });

  it("shows explicit spot and curve provenance lines", () => {
    render(
      <MarketTape
        error={null}
        isLoading={false}
        summary={summary}
        timespreads={timespreads}
      />
    );

    expect(screen.getByText(/SPOT \| OBSERVED \| EOD \| Gulf benchmarks \(static\) \| 2026-04-14/)).toBeInTheDocument();
    expect(screen.getByText(/CURVE \| CURATED \| EOD \| ICE Brent settlements \| 2026-04-14/)).toBeInTheDocument();
  });

  it("degrades gracefully when DME Oman / timespreads are unavailable", () => {
    const degraded: CrudeMarketSummary = {
      ...summary,
      dmeOman: undefined
    };
    render(
      <MarketTape
        error={null}
        isLoading={false}
        summary={degraded}
        timespreads={null}
      />
    );

    expect(screen.getByText("DME OMAN")).toBeInTheDocument();
    expect(screen.getByText("BRENT M1-M2")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(2);
  });
});
