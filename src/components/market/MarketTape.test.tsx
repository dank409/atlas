import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketTape } from "./MarketTape";
import type { CrudeMarketSummary } from "../../types/Market";

const summary: CrudeMarketSummary = {
  asOf: "2026-04-14",
  mode: "STATIC_SNAPSHOT",
  source: "Gulf benchmarks (static)",
  brent: { name: "BRENT", value: 77.35, change: 0.25, changePct: 0.32, asOf: "2026-04-14" },
  wti: { name: "WTI", value: 73.42, change: -0.18, changePct: -0.24, asOf: "2026-04-14" },
  dmeOman: { name: "DME_OMAN", value: 76.31, change: 0.42, changePct: 0.55, asOf: "2026-04-14" },
  murban: { name: "MURBAN", value: 77.07, change: 0.19, changePct: 0.25, asOf: "2026-04-14" },
  spread: -3.93,
  brentDmeOmanSpread: 1.04
};

describe("MarketTape", () => {
  it("renders loading state while data is in flight", () => {
    render(<MarketTape error={null} isLoading={true} summary={null} />);
    expect(screen.getByText("LOADING MARKET DATA…")).toBeInTheDocument();
  });

  it("renders offline state on error", () => {
    render(<MarketTape error={new Error("boom")} isLoading={false} summary={null} />);
    expect(screen.getByText("MARKET FEED OFFLINE")).toBeInTheDocument();
  });

  it("renders Brent, DME Oman, Murban, and Brent-Oman spread tiles", () => {
    render(<MarketTape error={null} isLoading={false} summary={summary} />);

    expect(screen.getByText("GULF")).toBeInTheDocument();

    expect(screen.getByText("BRENT")).toBeInTheDocument();
    expect(screen.getByText("$77.35")).toBeInTheDocument();

    expect(screen.getByText("DME OMAN")).toBeInTheDocument();
    expect(screen.getByText("$76.31")).toBeInTheDocument();

    expect(screen.getByText("MURBAN")).toBeInTheDocument();
    expect(screen.getByText("$77.07")).toBeInTheDocument();

    expect(screen.getByText("BRENT-OMAN")).toBeInTheDocument();
    expect(screen.getByText("+1.04")).toBeInTheDocument();
    expect(screen.getByText(/OMAN DISCOUNT/)).toBeInTheDocument();

    // WTI is still in the data layer but must NOT be surfaced on the tape.
    expect(screen.queryByText("WTI")).not.toBeInTheDocument();
    expect(screen.queryByText("WTI-BRENT")).not.toBeInTheDocument();
  });

  it("labels the tape STATIC when DME Oman snapshot mode is STATIC_SNAPSHOT", () => {
    render(<MarketTape error={null} isLoading={false} summary={summary} />);
    expect(screen.getByText("STATIC")).toBeInTheDocument();
    expect(screen.getByText(/AS OF 2026-04-14/)).toBeInTheDocument();
  });

  it("degrades gracefully when DME Oman / Murban fail to load (shows -- tiles)", () => {
    const degraded: CrudeMarketSummary = {
      ...summary,
      dmeOman: undefined,
      murban: undefined,
      brentDmeOmanSpread: undefined
    };
    render(<MarketTape error={null} isLoading={false} summary={degraded} />);

    expect(screen.getByText("DME OMAN")).toBeInTheDocument();
    expect(screen.getByText("MURBAN")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(2);
    // Spread tile is omitted entirely when the spread is undefined.
    expect(screen.queryByText("BRENT-OMAN")).not.toBeInTheDocument();
  });

  it("labels the spread OMAN PREMIUM when Brent is below Oman", () => {
    const inverted: CrudeMarketSummary = {
      ...summary,
      brent: { ...summary.brent, value: 75.0 },
      brentDmeOmanSpread: -1.31
    };
    render(<MarketTape error={null} isLoading={false} summary={inverted} />);
    expect(screen.getByText(/OMAN PREMIUM/)).toBeInTheDocument();
  });
});
