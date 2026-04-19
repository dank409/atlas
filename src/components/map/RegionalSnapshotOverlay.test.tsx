import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegionalSnapshotOverlay } from "./RegionalSnapshotOverlay";
import { DEFAULT_BYPASS_CONSTANTS, type BypassModelResult } from "../../utils/bypassModel";

function makeResult(overrides: Partial<BypassModelResult> = {}): BypassModelResult {
  return {
    state: "DEPLETING",
    disruptionPct: 60,
    constants: DEFAULT_BYPASS_CONSTANTS,
    grossDisruptedMbpd: 12.0,
    saudiBypassUtilisedMbpd: 5.0,
    uaeBypassUtilisedMbpd: 1.5,
    totalBypassUtilisedMbpd: 6.5,
    postBypassDeficitMbpd: 5.5,
    ieaDailyReleaseMbpd: 0,
    netDailyDeficitMbpd: 5.5,
    saudiUtilisationPct: 100,
    uaeUtilisationPct: 100,
    ieaExhaustionDays: null,
    daysToOperationalMinimum: 18.3,
    breachInventoryMb: 1000,
    rationale: "Test rationale",
    ...overrides
  };
}

describe("RegionalSnapshotOverlay", () => {
  it("renders the baseline tile without a scenario", () => {
    render(
      <RegionalSnapshotOverlay
        bypassResult={null}
        disruptionPct={0}
        firmsAlertCount={0}
        hormuzBaselineMbpd={20.5}
        refineryCount={53}
      />
    );
    // Hormuz flow is always present.
    expect(screen.getByText("HORMUZ FLOW")).toBeDefined();
    expect(screen.getByText("20.5")).toBeDefined();
    // Dashes for deficit / days when no scenario is live.
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(2);
  });

  it("renders scenario values when bypass result is present", () => {
    render(
      <RegionalSnapshotOverlay
        bypassResult={makeResult()}
        disruptionPct={60}
        firmsAlertCount={2}
        hormuzBaselineMbpd={20.5}
        refineryCount={53}
      />
    );
    expect(screen.getByText("60%")).toBeDefined();
    expect(screen.getByText("5.50")).toBeDefined();
    expect(screen.getByText("18.3")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("highlights days-to-min in red when under 30", () => {
    const { container } = render(
      <RegionalSnapshotOverlay
        bypassResult={makeResult({ daysToOperationalMinimum: 10 })}
        disruptionPct={80}
        firmsAlertCount={0}
        hormuzBaselineMbpd={20.5}
        refineryCount={53}
      />
    );
    // At least one value cell carries the toneNeg class.
    const negCells = container.querySelectorAll("[class*='toneNeg']");
    expect(negCells.length).toBeGreaterThanOrEqual(1);
  });
});
