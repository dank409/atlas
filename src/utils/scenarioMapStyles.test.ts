import { describe, expect, it } from "vitest";
import {
  FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD,
  FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT,
  FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD,
  computeBypassGlowColor,
  computeBypassGlowOpacity,
  computeBypassGlowWidthBonus,
  computeFeedstockRiskOpacity,
  computeHormuzHazardColor,
  computeHormuzHazardOpacity,
  computeHormuzHazardWidth,
  isFeedstockRiskActive
} from "./scenarioMapStyles";

describe("Hormuz hazard overlay", () => {
  it("returns zero opacity at idle", () => {
    expect(computeHormuzHazardOpacity(0)).toBe(0);
    expect(computeHormuzHazardOpacity(-5)).toBe(0);
  });

  it("rises monotonically with disruption %", () => {
    const low = computeHormuzHazardOpacity(20);
    const mid = computeHormuzHazardOpacity(60);
    const high = computeHormuzHazardOpacity(100);

    expect(low).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    expect(high).toBeLessThanOrEqual(0.78);
  });

  it("interpolates color from amber at 0 to red at 100", () => {
    expect(computeHormuzHazardColor(0)).toBe("rgb(255, 140, 0)");
    expect(computeHormuzHazardColor(100)).toBe("rgb(255, 23, 68)");
  });

  it("clamps color input above 100", () => {
    expect(computeHormuzHazardColor(250)).toBe("rgb(255, 23, 68)");
  });

  it("zero width when idle, scales up with disruption", () => {
    expect(computeHormuzHazardWidth(0)).toBe(0);
    expect(computeHormuzHazardWidth(100)).toBeGreaterThan(
      computeHormuzHazardWidth(25)
    );
  });
});

describe("Bypass pipeline glow", () => {
  it("is completely off when utilisation is zero", () => {
    expect(computeBypassGlowOpacity(0)).toBe(0);
    expect(computeBypassGlowWidthBonus(0)).toBe(0);
  });

  it("rises with utilisation and caps at saturation", () => {
    expect(computeBypassGlowOpacity(0.5)).toBeGreaterThan(
      computeBypassGlowOpacity(0.1)
    );
    expect(computeBypassGlowOpacity(1)).toBeLessThanOrEqual(0.9);
    expect(computeBypassGlowOpacity(2)).toBe(computeBypassGlowOpacity(1));
  });

  it("width bonus grows with utilisation", () => {
    const low = computeBypassGlowWidthBonus(0.2);
    const full = computeBypassGlowWidthBonus(1);

    expect(full).toBeGreaterThan(low);
    expect(full).toBeLessThanOrEqual(8);
  });

  it("color shifts from base amber to bright yellow", () => {
    expect(computeBypassGlowColor(0)).toBe("rgb(255, 140, 0)");
    expect(computeBypassGlowColor(1)).toBe("rgb(255, 214, 0)");
  });
});

describe("Feedstock-risk warning threshold", () => {
  it("fires only strictly above threshold", () => {
    expect(isFeedstockRiskActive(FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT)).toBe(
      false
    );
    expect(
      isFeedstockRiskActive(FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT + 1)
    ).toBe(true);
  });

  it("risk opacity zero at or below threshold", () => {
    expect(computeFeedstockRiskOpacity(0)).toBe(0);
    expect(computeFeedstockRiskOpacity(FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT)).toBe(
      0
    );
  });

  it("risk opacity rises monotonically above threshold", () => {
    const justAbove = computeFeedstockRiskOpacity(
      FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT + 5
    );
    const high = computeFeedstockRiskOpacity(90);
    const full = computeFeedstockRiskOpacity(100);

    expect(justAbove).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(justAbove);
    expect(full).toBeGreaterThan(high);
    expect(full).toBeLessThanOrEqual(0.95);
  });
});

describe("Feedstock-risk filter thresholds (dependency + capacity floor)", () => {
  // These mirror the compound Mapbox filter expression applied to the
  // refineries-feedstock-risk-layer. Keeping it tested as a pure
  // predicate lets us catch regressions in the constants without having
  // to spin up a real map instance.
  function passesFeedstockRiskFilter(feature: {
    hormuzDependency?: number;
    capacity_bpd?: number;
  }): boolean {
    const dependency = feature.hormuzDependency ?? 0;
    const capacity = feature.capacity_bpd ?? 0;
    return (
      dependency >= FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD &&
      capacity >= FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD
    );
  }

  it("dependency threshold is 0.5 and capacity floor is 50k bpd", () => {
    expect(FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD).toBe(0.5);
    expect(FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD).toBe(50_000);
  });

  it("passes a high-dependency large refinery (0.8 score, 200k bpd)", () => {
    expect(
      passesFeedstockRiskFilter({ hormuzDependency: 0.8, capacity_bpd: 200_000 })
    ).toBe(true);
  });

  it("rejects a low-dependency large refinery (0.2 score, 500k bpd)", () => {
    // Red Sea / Petroline-fed refineries must NOT show up even at 500k bpd.
    // This is the core improvement over the old capacity-only filter.
    expect(
      passesFeedstockRiskFilter({ hormuzDependency: 0.2, capacity_bpd: 500_000 })
    ).toBe(false);
  });

  it("rejects a high-dependency tiny topping unit (1.0 score, 10k bpd)", () => {
    // Fully Hormuz-dependent but too small to clutter the regional map.
    expect(
      passesFeedstockRiskFilter({ hormuzDependency: 1.0, capacity_bpd: 10_000 })
    ).toBe(false);
  });

  it("rejects an uncurated refinery (no dependency score) regardless of capacity", () => {
    // Uncurated features default to dependency 0, which is below the cut.
    // This is the "assume resilient" fallback documented in workspaceData.ts.
    expect(
      passesFeedstockRiskFilter({ capacity_bpd: 1_000_000 })
    ).toBe(false);
  });

  it("exactly at the dependency threshold still passes", () => {
    expect(
      passesFeedstockRiskFilter({
        hormuzDependency: FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD,
        capacity_bpd: FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD
      })
    ).toBe(true);
  });
});
