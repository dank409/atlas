import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketsPage } from "./MarketsPage";

describe("MarketsPage", () => {
  it("renders the price grid + honest AWAITING FEED placeholders", () => {
    render(
      <MarketsPage
        brentHistoricalSeries={[]}
        brentWtiSnapshot={null}
        dmeOmanSnapshot={null}
        iceSnapshot={null}
        mode="STATIC_SNAPSHOT"
        murbanSnapshot={null}
        refineryMargins={null}
        rigCount={null}
        summary={null}
        timespreads={null}
      />
    );
    // Spot grid is always present even with no data.
    expect(screen.getByText("CRUDE · SPOT")).toBeDefined();
    // Correlations renders empty state when there's insufficient data.
    expect(screen.getByText("CORRELATIONS")).toBeDefined();
    expect(screen.getByText("INSUFFICIENT OVERLAPPING DATA")).toBeDefined();
    // Remaining AWAITING FEED tiles: FREIGHT and FX only (others
    // were replaced with real-data modules in the yellow-tier pass).
    expect(screen.getByText("FREIGHT · TANKERS")).toBeDefined();
    expect(screen.getByText("REFINERY MARGINS")).toBeDefined();
    expect(screen.getByText("FX · REGIONAL")).toBeDefined();
  });
});
