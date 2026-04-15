import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "./StatusBar";
import type { CrudeMarketSummary } from "../../types/Market";

const summary: CrudeMarketSummary = {
  asOf: "2026-04-14",
  brent: {
    name: "BRENT",
    value: 82.5,
    change: 0.4,
    changePct: 0.5,
    asOf: "2026-04-14"
  },
  wti: {
    name: "WTI",
    value: 78.0,
    change: -0.2,
    changePct: -0.3,
    asOf: "2026-04-14"
  },
  spread: -4.5,
  mode: "LIVE",
  source: "EIA"
};

describe("StatusBar", () => {
  it("renders CONNECTED status and the full stat row when there is no error", () => {
    render(
      <StatusBar
        activeAssetCount={312}
        activeDatasetCount={4}
        hasError={false}
        lastUpdate="2026-04-14"
        marketSummary={summary}
        sourceCount={4}
      />
    );

    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    expect(screen.getByText("REGION: MIDDLE EAST")).toBeInTheDocument();
    expect(screen.getByText(/EIA: BRENT \$82\.50 · 2026-04-14/)).toBeInTheDocument();
    expect(screen.getByText("DATASETS: 4")).toBeInTheDocument();
    expect(screen.getByText("VISIBLE ASSETS: 312")).toBeInTheDocument();
    expect(screen.getByText("LAST UPDATE: 2026-04-14")).toBeInTheDocument();
    expect(screen.getByText("SOURCES: 4 ACTIVE")).toBeInTheDocument();
  });

  it("shows OFFLINE status and forces source count to 0 on error", () => {
    render(
      <StatusBar
        activeAssetCount={0}
        activeDatasetCount={0}
        hasError={true}
        lastUpdate="--"
        marketSummary={null}
        sourceCount={4}
      />
    );

    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
    expect(screen.getByText("SOURCES: 0 ACTIVE")).toBeInTheDocument();
  });

  it("falls back to EIA: -- when no market summary is provided", () => {
    render(
      <StatusBar
        activeAssetCount={10}
        activeDatasetCount={1}
        hasError={false}
        lastUpdate="2026-04-14"
        marketSummary={null}
        sourceCount={1}
      />
    );

    expect(screen.getByText("EIA: --")).toBeInTheDocument();
  });
});
