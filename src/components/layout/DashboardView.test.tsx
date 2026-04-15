import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "./DashboardView";
import { runBypassScenario } from "../../utils/bypassModel";
import type { InfrastructureAsset } from "../../types/Infrastructure";

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

describe("DashboardView", () => {
  it("renders the 8-tile Connecting Thread situation room (no chrome tiles)", () => {
    render(
      <DashboardView
        brentHistorical={null}
        bypassResult={idleBypassResult}
        isScenarioActive={false}
        firmsSnapshot={null}
        firmsIsLoading={false}
        firmsError={null}
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
        visibleAssets={visibleAssets}
      />
    );

    expect(screen.getByText("SITUATION ROOM")).toBeInTheDocument();

    // The 7 analytical tiles that survived the Connecting Thread
    // stress test.
    expect(screen.getByText("BYPASS SCENARIO")).toBeInTheDocument();
    expect(screen.getByText("FORWARD CURVE")).toBeInTheDocument();
    expect(screen.getByText("BRENT HISTORICAL")).toBeInTheDocument();
    expect(screen.getByText("FIRMS ALERT FEED")).toBeInTheDocument();
    expect(screen.getByText("CHOKEPOINT WATCH")).toBeInTheDocument();
    expect(screen.getByText("MARKET BRIEF")).toBeInTheDocument();
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

  it("opens a tile-expand overlay when the BYPASS SCENARIO header is clicked, and closes on Escape", () => {
    render(
      <DashboardView
        brentHistorical={null}
        bypassResult={idleBypassResult}
        isScenarioActive={false}
        firmsSnapshot={null}
        firmsIsLoading={false}
        firmsError={null}
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
        visibleAssets={visibleAssets}
      />
    );

    // No overlay open at rest.
    expect(
      screen.queryByRole("button", { name: /Close expanded tile/i })
    ).not.toBeInTheDocument();

    // Clicking the BYPASS SCENARIO header opens the expand overlay.
    // The header button carries a title="Expand BYPASS SCENARIO".
    fireEvent.click(screen.getByTitle("Expand BYPASS SCENARIO"));

    // Overlay is now mounted with a close button + "SCENARIO OUTPUT"
    // kind label.
    expect(
      screen.getByRole("button", { name: /Close expanded tile/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/SCENARIO OUTPUT/)).toBeInTheDocument();

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
});
