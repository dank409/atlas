import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceGridModule } from "./PriceGridModule";
import type {
  BenchmarkQuote,
  CrudeMarketSummary,
  CrudePriceSnapshot
} from "../../types/Market";

function quote(overrides: Partial<BenchmarkQuote> & { name: BenchmarkQuote["name"]; value: number }): BenchmarkQuote {
  return {
    asOf: "2026-04-13",
    cadence: "EOD",
    change: 0,
    changePct: 0,
    classification: "OBSERVED",
    source: "EIA",
    ...overrides
  };
}

function makeSummary(overrides?: Partial<CrudeMarketSummary>): CrudeMarketSummary {
  return {
    asOf: "2026-04-13",
    brent: quote({ name: "BRENT", value: 84.72, change: 0.43, changePct: 0.51 }),
    wti: quote({ name: "WTI", value: 80.94, change: -0.12, changePct: -0.15 }),
    dmeOman: quote({ name: "DME_OMAN", value: 83.41, change: 0.29, changePct: 0.35 }),
    murban: quote({ name: "MURBAN", value: 84.11, change: 0.34, changePct: 0.41 }),
    brentWtiSpread: 3.78,
    brentDmeOmanSpread: 1.31,
    cadence: "EOD",
    classification: "OBSERVED",
    source: "EIA",
    ...overrides
  };
}

function brentWti(): CrudePriceSnapshot {
  const brent = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    value: 80 + i * 0.1
  }));
  const wti = brent.map((p) => ({ date: p.date, value: p.value - 4 }));
  return {
    source: "EIA",
    cadence: "EOD",
    classification: "OBSERVED",
    asOf: "2026-04-13",
    series: { brent, wti }
  };
}

describe("PriceGridModule", () => {
  it("renders the four crude benchmarks when all data is present", () => {
    render(
      <PriceGridModule
        brentWtiSnapshot={brentWti()}
        dmeOmanSnapshot={null}
        mode="LIVE"
        murbanSnapshot={null}
        summary={makeSummary()}
      />
    );
    expect(screen.getByText("BRENT")).toBeDefined();
    expect(screen.getByText("WTI")).toBeDefined();
    expect(screen.getByText("DME OMAN")).toBeDefined();
    expect(screen.getByText("MURBAN")).toBeDefined();
  });

  it("shows dashes when summary is null", () => {
    const { container } = render(
      <PriceGridModule
        brentWtiSnapshot={null}
        dmeOmanSnapshot={null}
        mode="STATIC_SNAPSHOT"
        murbanSnapshot={null}
        summary={null}
      />
    );
    // Every value cell renders as "--" in this state.
    const dashCells = Array.from(container.querySelectorAll("span")).filter(
      (el) => el.textContent === "--"
    );
    expect(dashCells.length).toBeGreaterThanOrEqual(8);
  });

  it("shows STATIC badge when mode is STATIC_SNAPSHOT", () => {
    render(
      <PriceGridModule
        brentWtiSnapshot={null}
        dmeOmanSnapshot={null}
        mode="STATIC_SNAPSHOT"
        murbanSnapshot={null}
        summary={makeSummary()}
      />
    );
    expect(screen.getByText("STATIC")).toBeDefined();
  });
});

