import type { FirmsSnapshot } from "../../types/firms";
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
    asOf: "2026-04-14",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "EIA"
  },
  wti: {
    name: "WTI",
    value: 78.0,
    change: -0.2,
    changePct: -0.3,
    asOf: "2026-04-14",
    cadence: "EOD",
    classification: "OBSERVED",
    source: "EIA"
  },
  brentWtiSpread: 4.5,
  cadence: "EOD",
  classification: "OBSERVED",
  source: "EIA"
};

const firmsSnapshot: FirmsSnapshot = {
  asOf: "2026-04-14T12:00:00Z",
  cadence: "NRT_SATELLITE",
  classification: "OBSERVED",
  confidenceThreshold: 80,
  detections: [],
  matches: [],
  anomalies: [],
  source: "NASA FIRMS",
  windowHours: 72
};

describe("StatusBar", () => {
  it("renders cadence-first workspace context without connectivity theater", () => {
    render(
      <StatusBar
        activeAssetCount={312}
        activeDatasetCount={4}
        firmsSnapshot={firmsSnapshot}
        hasError={false}
        lastUpdate="2026-04-14"
        marketSummary={summary}
      />
    );

    expect(screen.getByText("REGION: MIDDLE EAST")).toBeInTheDocument();
    expect(screen.getByText("WORKSPACE: READY")).toBeInTheDocument();
    expect(screen.getByText(/MARKET: BRENT \$82\.50 \| OBSERVED \| EOD/)).toBeInTheDocument();
    expect(screen.getByText(/FIRMS: OBSERVED \| NRT SATELLITE/)).toBeInTheDocument();
    expect(screen.getByText("DATASETS: 4")).toBeInTheDocument();
    expect(screen.getByText("VISIBLE ASSETS: 312")).toBeInTheDocument();
    expect(screen.getByText("MAP: QUARTERLY | 2026-04-14")).toBeInTheDocument();
    expect(screen.queryByText("CONNECTED")).not.toBeInTheDocument();
    expect(screen.queryByText(/SOURCES:/)).not.toBeInTheDocument();
  });

  it("shows PARTIAL workspace state on error without pretending sources are offline", () => {
    render(
      <StatusBar
        activeAssetCount={0}
        activeDatasetCount={0}
        hasError={true}
        lastUpdate="--"
        marketSummary={null}
      />
    );

    expect(screen.getByText("WORKSPACE: PARTIAL")).toBeInTheDocument();
    expect(screen.queryByText("OFFLINE")).not.toBeInTheDocument();
  });

  it("falls back to NO OPEN DATA labels when market and FIRMS summaries are missing", () => {
    render(
      <StatusBar
        activeAssetCount={10}
        activeDatasetCount={1}
        hasError={false}
        lastUpdate="2026-04-14"
        marketSummary={null}
      />
    );

    expect(screen.getByText("MARKET: NO OPEN DATA")).toBeInTheDocument();
    expect(screen.getByText("FIRMS: NO OPEN DATA")).toBeInTheDocument();
  });
});
