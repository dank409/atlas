import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskFeedModule } from "./RiskFeedModule";
import type { FirmsFacilityAnomaly } from "../../types/firms";
import type { OutageEvent } from "../../types/outageEvent";

function outage(overrides: Partial<OutageEvent> & { id: string; date: string }): OutageEvent {
  return {
    name: "Test outage",
    country: "SA",
    severity: "HIGH",
    category: "attack",
    outageVolumeBpd: 1000,
    durationDays: 1,
    summary: "Something bad happened.",
    resolved: false,
    ...overrides
  };
}

function firmsAnomaly(
  id: string,
  severity: "ELEVATED" | "ALERT" | "NORMAL",
  latest: string
): FirmsFacilityAnomaly {
  return {
    asset: {
      id,
      name: `Facility ${id}`,
      assetType: "refinery",
      center: { lat: 0, lon: 0 },
      radiusKm: 3
    },
    windowCount: 12,
    baselineMean: 2,
    baselineStdev: 1,
    zScore: 10,
    ratioToBaseline: 6,
    severity,
    latestDetectionAt: latest
  };
}

describe("RiskFeedModule", () => {
  it("shows empty state when nothing to display", () => {
    render(<RiskFeedModule firmsAnomalies={[]} outageEvents={[]} />);
    expect(screen.getByText("NO EVENTS")).toBeDefined();
  });

  it("renders outage events with MM-DD timestamp and tags", () => {
    render(
      <RiskFeedModule
        firmsAnomalies={[]}
        outageEvents={[outage({ id: "o1", date: "2026-04-12" })]}
      />
    );
    expect(screen.getByText("04-12")).toBeDefined();
    expect(screen.getByText("ATTACK")).toBeDefined();
    expect(screen.getByText("ONGOING")).toBeDefined();
  });

  it("filters out NORMAL-severity FIRMS anomalies", () => {
    render(
      <RiskFeedModule
        firmsAnomalies={[firmsAnomaly("fa1", "NORMAL", "2026-04-12T00:00:00Z")]}
        outageEvents={[]}
      />
    );
    expect(screen.getByText("NO EVENTS")).toBeDefined();
  });

  it("merges outage events and FIRMS alerts sorted most-recent-first", () => {
    const { container } = render(
      <RiskFeedModule
        firmsAnomalies={[firmsAnomaly("fa1", "ALERT", "2026-04-14T00:00:00Z")]}
        outageEvents={[outage({ id: "o1", date: "2026-04-12" })]}
      />
    );
    const items = container.querySelectorAll("[class*='item']");
    // Most recent (FIRMS 04-14) should appear first.
    expect(items[0]?.textContent).toContain("04-14");
    expect(items[1]?.textContent).toContain("04-12");
  });

  it("respects the limit prop", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      outage({ id: `o${i}`, date: `2026-04-${String(i + 1).padStart(2, "0")}` })
    );
    const { container } = render(
      <RiskFeedModule firmsAnomalies={[]} limit={3} outageEvents={events} />
    );
    const items = container.querySelectorAll("[class*='item']");
    expect(items.length).toBe(3);
  });
});
