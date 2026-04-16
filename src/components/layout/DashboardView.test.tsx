import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "./DashboardView";
import { runBypassScenario } from "../../utils/bypassModel";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary,
  EiaWeeklyInventorySnapshot
} from "../../types/Market";

const idleBypassResult = runBypassScenario({ disruptionPct: 0 });

const visibleAssets: InfrastructureAsset[] = [
  {
    assetKind: "chokepoint",
    datasetId: "chokepoints",
    id: "chokepoint-hormuz",
    name: "Strait of Hormuz",
    country: "ME",
    countryName: "Middle East",
    status: "strategic",
    transitVolume_mbpd: 20.5,
    geometry: {
      type: "LineString",
      coordinates: [
        [56.0, 26.7],
        [56.5, 26.3]
      ]
    },
    _metadata: {
      source: "Curated chokepoint seed",
      downloadDate: "2026-04-14"
    }
  },
  {
    assetKind: "chokepoint",
    datasetId: "chokepoints",
    id: "chokepoint-bab-el-mandeb",
    name: "Bab el-Mandeb",
    country: "YE",
    countryName: "Yemen / Djibouti",
    status: "strategic",
    transitVolume_mbpd: 5.0,
    geometry: {
      type: "LineString",
      coordinates: [
        [43.3, 12.6],
        [43.5, 12.4]
      ]
    },
    _metadata: {
      source: "Curated chokepoint seed",
      downloadDate: "2026-04-14"
    }
  }
];

const inventorySnapshot: EiaWeeklyInventorySnapshot = {
  asOf: "2026-04-15",
  cadence: "WEEKLY",
  classification: "OBSERVED",
  latest: {
    date: "2026-04-15",
    value: 421.8,
    fiveYearAverage: 421.5,
    fiveYearMin: 394.2,
    fiveYearMax: 432.7,
    deltaVsAverage: 0.3,
    deltaPctVsAverage: 0.07,
    rangePosition: 0.717,
    rangePositionLabel: "WITHIN_RANGE"
  },
  source: "EIA",
  seriesName: "US Commercial Crude Excluding SPR",
  units: "million_barrels",
  series: [
    {
      date: "2026-04-08",
      value: 423.6,
      fiveYearAverage: 422.2,
      fiveYearMin: 394.8,
      fiveYearMax: 434.1
    },
    {
      date: "2026-04-15",
      value: 421.8,
      fiveYearAverage: 421.5,
      fiveYearMin: 394.2,
      fiveYearMax: 432.7
    }
  ]
};

const marketSummary: CrudeMarketSummary = {
  asOf: "2026-04-14",
  cadence: "EOD",
  classification: "OBSERVED",
  source: "EIA",
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
  brentWtiSpread: 3.93
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

describe("DashboardView", () => {
  it("renders the macro research tiles without the old chrome filler", () => {
    render(
      <DashboardView
        brentHistorical={null}
        bypassResult={idleBypassResult}
        isScenarioActive={false}
        firmsSnapshot={null}
        firmsIsLoading={false}
        firmsError={null}
        inventorySnapshot={inventorySnapshot}
        inventoryIsLoading={false}
        inventoryError={null}
        firmsWindowHours={72}
        firmsConfidenceThreshold={80}
        isFirmsLayerEnabled={true}
        onFirmsWindowChange={() => {}}
        onFirmsConfidenceChange={() => {}}
        onFirmsLayerToggle={() => {}}
        iceSettlements={null}
        lastUpdate="2026-04-14"
        marketSummary={null}
        outageEvents={null}
        timespreads={null}
        visibleAssets={visibleAssets}
      />
    );

    expect(screen.getByText("SITUATION ROOM")).toBeInTheDocument();

    expect(screen.getAllByText("SCENARIO LAB").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("FORWARD CURVE")).toBeInTheDocument();
    expect(screen.getByText("BRENT HISTORICAL")).toBeInTheDocument();
    expect(screen.getByText("FIRMS ALERT FEED")).toBeInTheDocument();
    expect(screen.getByText("CHOKEPOINT WATCH")).toBeInTheDocument();
    expect(screen.getByText("MARKET BRIEF")).toBeInTheDocument();
    expect(screen.getByText("US INVENTORIES")).toBeInTheDocument();
    expect(screen.getByText("FIRMS CONTROLS")).toBeInTheDocument();

    // The five chrome / low-value tiles removed in the Connecting
    // Thread pass should NOT render. Their absence is the point —
    // the dashboard now only carries tiles that move under the
    // Hormuz slider or feed data into something that does.
    // (ACTIVITY LOG moved to the status-bar ticker to keep the
    // "every action leaves a trace" contract without burning a
    // dashboard slot.)
    expect(screen.queryByText("WORKSPACE SNAPSHOT")).not.toBeInTheDocument();
    expect(screen.queryByText("CURRENT SELECTION")).not.toBeInTheDocument();
    expect(screen.queryByText("PRIORITY ASSETS")).not.toBeInTheDocument();
    expect(screen.queryByText("NEWS WIRE")).not.toBeInTheDocument();
    expect(screen.queryByText("ACTIVITY LOG")).not.toBeInTheDocument();

    // Chokepoints still show by transit-volume order.
    expect(screen.getByText("Strait of Hormuz")).toBeInTheDocument();
    expect(screen.getByText("Bab el-Mandeb")).toBeInTheDocument();
  });

  it("opens a tile-expand overlay when the SCENARIO LAB header is clicked, and closes on Escape", () => {
    render(
      <DashboardView
        brentHistorical={null}
        bypassResult={idleBypassResult}
        isScenarioActive={false}
        firmsSnapshot={null}
        firmsIsLoading={false}
        firmsError={null}
        inventorySnapshot={inventorySnapshot}
        inventoryIsLoading={false}
        inventoryError={null}
        firmsWindowHours={72}
        firmsConfidenceThreshold={80}
        isFirmsLayerEnabled={true}
        onFirmsWindowChange={() => {}}
        onFirmsConfidenceChange={() => {}}
        onFirmsLayerToggle={() => {}}
        iceSettlements={null}
        lastUpdate="2026-04-14"
        marketSummary={null}
        outageEvents={null}
        timespreads={null}
        visibleAssets={visibleAssets}
      />
    );

    // No overlay open at rest.
    expect(
      screen.queryByRole("button", { name: /Close expanded tile/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Expand SCENARIO LAB"));

    // Overlay is now mounted with a close button + modeled-path
    // kind label.
    expect(
      screen.getByRole("button", { name: /Close expanded tile/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/MODELED PATH/)).toBeInTheDocument();

    // Escape dismisses the overlay.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /Close expanded tile/i })
    ).not.toBeInTheDocument();
  });

  it("routes CHOKEPOINT WATCH row clicks through onInspectAsset", () => {
    const onInspect = vi.fn();
    render(
      <DashboardView
        brentHistorical={null}
        bypassResult={idleBypassResult}
        isScenarioActive={false}
        firmsSnapshot={null}
        firmsIsLoading={false}
        firmsError={null}
        inventorySnapshot={inventorySnapshot}
        inventoryIsLoading={false}
        inventoryError={null}
        firmsWindowHours={72}
        firmsConfidenceThreshold={80}
        isFirmsLayerEnabled={true}
        onFirmsWindowChange={() => {}}
        onFirmsConfidenceChange={() => {}}
        onFirmsLayerToggle={() => {}}
        iceSettlements={null}
        lastUpdate="2026-04-14"
        marketSummary={null}
        outageEvents={null}
        onInspectAsset={onInspect}
        timespreads={null}
        visibleAssets={visibleAssets}
      />
    );

    const chokepointPanel = screen.getByText("CHOKEPOINT WATCH").closest("section")!;
    const hormuzRow = within(chokepointPanel)
      .getByText("Strait of Hormuz")
      .closest("tr")!;
    fireEvent.click(hormuzRow);

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "chokepoint-hormuz" })
    );
  });

  it("shows Brent prompt structure and inventory latest context in the macro tiles", () => {
    render(
      <DashboardView
        brentHistorical={null}
        bypassResult={idleBypassResult}
        isScenarioActive={false}
        firmsSnapshot={null}
        firmsIsLoading={false}
        firmsError={null}
        inventorySnapshot={inventorySnapshot}
        inventoryIsLoading={false}
        inventoryError={null}
        firmsWindowHours={72}
        firmsConfidenceThreshold={80}
        isFirmsLayerEnabled={true}
        onFirmsWindowChange={() => {}}
        onFirmsConfidenceChange={() => {}}
        onFirmsLayerToggle={() => {}}
        iceSettlements={null}
        lastUpdate="2026-04-14"
        marketSummary={marketSummary}
        outageEvents={null}
        timespreads={timespreads}
        visibleAssets={visibleAssets}
      />
    );

    expect(screen.getByText("BRENT M1-M2")).toBeInTheDocument();
    expect(screen.getByText("BACKWARDATION")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Expand US INVENTORIES"));
    expect(screen.getByText("421.8 MMBBL")).toBeInTheDocument();
    expect(screen.getByText("72% OF 5Y RANGE")).toBeInTheDocument();
  });
});
