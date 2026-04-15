import { describe, expect, it } from "vitest";
import {
  DEFAULT_BYPASS_CONSTANTS,
  HORMUZ_CRUDE_FLOW_MBPD,
  IEA_CUMULATIVE_CAP_MB,
  IEA_MAX_RATE_MBPD,
  OPERATIONAL_MINIMUM_MB,
  SAUDI_SPARE_CAPACITY_MBPD,
  STARTING_INVENTORY_MB,
  UAE_SPARE_CAPACITY_MBPD,
  runBypassScenario,
  simulateIeaDrawdown
} from "./bypassModel";

// ===========================================================================
// Baseline constants — commercial corrections (2026-04-15)
// ===========================================================================

describe("bypassModel — commercial baseline constants", () => {
  it("exposes the stress-tested baseline constants verbatim", () => {
    // These are the values the commercial risk modeler corrected:
    // Hormuz must isolate crude+condensate (14.7), Saudi spare reflects
    // Yanbu loading bottlenecks (2.9), UAE spare reflects pre-crisis
    // ADCOP utilisation (0.7), and IEA is hydraulically capped at 4.0 mbpd.
    expect(HORMUZ_CRUDE_FLOW_MBPD).toBe(14.7);
    expect(SAUDI_SPARE_CAPACITY_MBPD).toBe(2.9);
    expect(UAE_SPARE_CAPACITY_MBPD).toBe(0.7);
    expect(IEA_MAX_RATE_MBPD).toBe(4.0);
    expect(IEA_CUMULATIVE_CAP_MB).toBe(400);
    expect(STARTING_INVENTORY_MB).toBe(968);
    expect(OPERATIONAL_MINIMUM_MB).toBe(842);
  });

  it("DEFAULT_BYPASS_CONSTANTS mirrors the exported scalar constants", () => {
    expect(DEFAULT_BYPASS_CONSTANTS).toEqual({
      hormuzCrudeFlowMbpd: 14.7,
      saudiSpareCapacityMbpd: 2.9,
      uaeSpareCapacityMbpd: 0.7,
      ieaMaxRateMbpd: 4.0,
      ieaCumulativeCapMb: 400,
      startingInventoryMb: 968,
      operationalMinimumMb: 842
    });
  });
});

// ===========================================================================
// Standard depletion — full Hormuz closure (100% disruption)
// ===========================================================================

describe("runBypassScenario — standard depletion (100% disruption)", () => {
  const result = runBypassScenario({ disruptionPct: 100 });

  it("classifies the state as DEPLETING", () => {
    expect(result.state).toBe("DEPLETING");
  });

  it("reports the full 14.7 mbpd Hormuz crude flow as gross disrupted", () => {
    expect(result.grossDisruptedMbpd).toBe(14.7);
  });

  it("saturates both bypass pipelines via Saudi-first merit order", () => {
    expect(result.saudiBypassUtilisedMbpd).toBe(2.9);
    expect(result.uaeBypassUtilisedMbpd).toBe(0.7);
    expect(result.totalBypassUtilisedMbpd).toBe(3.6);
    expect(result.saudiUtilisationPct).toBe(1);
    expect(result.uaeUtilisationPct).toBe(1);
  });

  it("engages IEA at its 4.0 mbpd hydraulic ceiling", () => {
    expect(result.postBypassDeficitMbpd).toBe(11.1);
    expect(result.ieaDailyReleaseMbpd).toBe(4);
  });

  it("reports a 7.10 mbpd net daily deficit after bypass + IEA", () => {
    expect(result.netDailyDeficitMbpd).toBe(7.1);
  });

  it("computes ~17.75 days to operational minimum (phase-1 breach)", () => {
    // Buffer = 968 - 842 = 126 mb
    // Phase-1 inventory draw rate = postBypass - IEA = 11.1 - 4 = 7.1 mbpd
    // Phase-1 max draw before IEA cap = 7.1 × 100 = 710 mb >> 126 mb buffer
    // → breach occurs in phase 1: 126 / 7.1 = 17.7464... → 17.75
    expect(result.daysToOperationalMinimum).toBe(17.75);
    expect(result.breachInventoryMb).toBe(842);
  });

  it("still reports IEA exhaustion runway even though the breach precedes it", () => {
    // 400 mb cap / 4.0 mbpd = 100 days. Breach occurs at ~17.75 days,
    // well before exhaustion, but the runway figure is still useful.
    expect(result.ieaExhaustionDays).toBe(100);
  });

  it("includes a non-empty rationale string", () => {
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Phase-2 breach path — bypass + IEA postpone breach past IEA exhaustion
// ===========================================================================

describe("runBypassScenario — two-phase breach path (IEA exhausts first)", () => {
  // Override Hormuz flow to 8.6 mbpd so that the math lands on round
  // numbers and we can assert the phase-2 contribution exactly:
  //   gross = 8.6, totalBypass = 3.6, postBypass = 5.0
  //   IEA = 4.0, netDaily = 1.0 (DEPLETING)
  //   phase-1 draw rate = 5.0 - 4.0 = 1.0 mbpd
  //   IEA exhausts at day 400/4 = 100
  //   phase-1 cumulative draw at exhaustion = 1.0 × 100 = 100 mb
  //   buffer at phase 2 = 126 - 100 = 26 mb
  //   phase-2 days = 26 / 5.0 = 5.2
  //   total = 100 + 5.2 = 105.2
  const result = runBypassScenario({
    disruptionPct: 100,
    overrides: { hormuzCrudeFlowMbpd: 8.6 }
  });

  it("classifies the state as DEPLETING", () => {
    expect(result.state).toBe("DEPLETING");
  });

  it("reports the override-driven flow accounting", () => {
    expect(result.grossDisruptedMbpd).toBe(8.6);
    expect(result.totalBypassUtilisedMbpd).toBe(3.6);
    expect(result.postBypassDeficitMbpd).toBe(5);
    expect(result.ieaDailyReleaseMbpd).toBe(4);
    expect(result.netDailyDeficitMbpd).toBe(1);
  });

  it("composes phase-1 + phase-2 days when IEA exhausts before the breach", () => {
    expect(result.ieaExhaustionDays).toBe(100);
    expect(result.daysToOperationalMinimum).toBe(105.2);
  });
});

// ===========================================================================
// Equilibrium — bypass alone fully absorbs the disruption
// ===========================================================================

describe("runBypassScenario — bypass-only equilibrium (20% disruption)", () => {
  const result = runBypassScenario({ disruptionPct: 20 });

  it("classifies the state as EQUILIBRIUM", () => {
    expect(result.state).toBe("EQUILIBRIUM");
  });

  it("uses Saudi fully and UAE partially via merit order", () => {
    expect(result.grossDisruptedMbpd).toBe(2.94);
    expect(result.saudiBypassUtilisedMbpd).toBe(2.9);
    expect(result.uaeBypassUtilisedMbpd).toBe(0.04);
    expect(result.totalBypassUtilisedMbpd).toBe(2.94);
  });

  it("does not engage IEA when bypass fully covers the disruption", () => {
    expect(result.postBypassDeficitMbpd).toBe(0);
    expect(result.ieaDailyReleaseMbpd).toBe(0);
    expect(result.netDailyDeficitMbpd).toBe(0);
  });

  it("returns null days-to-breach — the anti-divide-by-zero safeguard", () => {
    expect(result.daysToOperationalMinimum).toBeNull();
    expect(result.breachInventoryMb).toBeNull();
    expect(result.ieaExhaustionDays).toBeNull();
  });
});

// ===========================================================================
// Equilibrium — IEA absorbs post-bypass shortfall (still flat, but limited)
// ===========================================================================

describe("runBypassScenario — IEA-assisted equilibrium (50% disruption)", () => {
  const result = runBypassScenario({ disruptionPct: 50 });

  it("classifies the state as EQUILIBRIUM (net daily deficit = 0)", () => {
    expect(result.state).toBe("EQUILIBRIUM");
    expect(result.grossDisruptedMbpd).toBe(7.35);
    expect(result.totalBypassUtilisedMbpd).toBe(3.6);
    expect(result.postBypassDeficitMbpd).toBe(3.75);
    expect(result.ieaDailyReleaseMbpd).toBe(3.75);
    expect(result.netDailyDeficitMbpd).toBe(0);
  });

  it("does not publish a days-to-operational-minimum number", () => {
    // EQUILIBRIUM is EQUILIBRIUM even when sustained by a depleting buffer.
    // The safeguard says: don't return a number unless DEPLETING.
    expect(result.daysToOperationalMinimum).toBeNull();
    expect(result.breachInventoryMb).toBeNull();
  });

  it("still exposes IEA cap exhaustion horizon for UI warning", () => {
    // 400 mb cap / 3.75 mbpd ≈ 106.67 days
    expect(result.ieaExhaustionDays).toBeCloseTo(106.67, 2);
  });
});

// ===========================================================================
// Replenishing safeguard — division-by-zero / negative-days protection
// ===========================================================================

describe("runBypassScenario — REPLENISHING safeguard (negative disruption)", () => {
  // Non-physical but algorithmically critical: ensures the function's
  // branching handles negative deficits without ever returning negative
  // days or dividing by a non-positive denominator.
  const result = runBypassScenario({ disruptionPct: -10 });

  it("classifies the state as REPLENISHING instead of returning negative days", () => {
    expect(result.state).toBe("REPLENISHING");
    expect(result.netDailyDeficitMbpd).toBeLessThan(0);
  });

  it("clamps bypass and IEA to zero when gross disruption is negative", () => {
    expect(result.saudiBypassUtilisedMbpd).toBe(0);
    expect(result.uaeBypassUtilisedMbpd).toBe(0);
    expect(result.totalBypassUtilisedMbpd).toBe(0);
    expect(result.ieaDailyReleaseMbpd).toBe(0);
  });

  it("does not compute days-to-breach in the REPLENISHING branch", () => {
    expect(result.daysToOperationalMinimum).toBeNull();
    expect(result.breachInventoryMb).toBeNull();
    expect(result.ieaExhaustionDays).toBeNull();
  });

  it("does not return any negative day count anywhere in the result", () => {
    // Belt-and-suspenders: scan every numeric field for negatives.
    const numericFields: Array<number | null> = [
      result.daysToOperationalMinimum,
      result.ieaExhaustionDays,
      result.breachInventoryMb
    ];
    for (const field of numericFields) {
      if (field !== null) {
        expect(field).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ===========================================================================
// Zero disruption — everything zero, no edge-case panic
// ===========================================================================

describe("runBypassScenario — zero disruption", () => {
  const result = runBypassScenario({ disruptionPct: 0 });

  it("reports clean zeros across every field", () => {
    expect(result.state).toBe("EQUILIBRIUM");
    expect(result.grossDisruptedMbpd).toBe(0);
    expect(result.totalBypassUtilisedMbpd).toBe(0);
    expect(result.postBypassDeficitMbpd).toBe(0);
    expect(result.ieaDailyReleaseMbpd).toBe(0);
    expect(result.netDailyDeficitMbpd).toBe(0);
    expect(result.daysToOperationalMinimum).toBeNull();
    expect(result.ieaExhaustionDays).toBeNull();
  });
});

// ===========================================================================
// Floating-point precision — IEEE 754 artifact prevention
// ===========================================================================

describe("runBypassScenario — floating-point precision (IEEE 754 artifacts)", () => {
  it("rounds 14.7 × 0.3 cleanly to 4.41 mbpd", () => {
    // Raw IEEE: 14.7 * 0.3 = 4.409999999999999 — the canonical artifact.
    // round2() must collapse this to 4.41.
    const result = runBypassScenario({ disruptionPct: 30 });
    expect(result.grossDisruptedMbpd).toBe(4.41);
    // Saudi 2.9 + UAE 0.7 = 3.6, post-bypass = 4.41 - 3.6 = 0.81
    expect(result.postBypassDeficitMbpd).toBe(0.81);
  });

  it("rounds 14.7 × 0.7 cleanly to 10.29 mbpd", () => {
    // Raw IEEE: 14.7 * 0.7 = 10.290000000000001
    const result = runBypassScenario({ disruptionPct: 70 });
    expect(result.grossDisruptedMbpd).toBe(10.29);
    expect(result.postBypassDeficitMbpd).toBe(6.69);
  });

  it("returns clean 0.01-precision values across a sweep of disruption levels", () => {
    // Direct equality assertions — both sides are the same IEEE float
    // because the literal and `round2()` collapse to the same bit pattern.
    const cases: Array<[number, number]> = [
      [10, 1.47],
      [20, 2.94],
      [30, 4.41],
      [40, 5.88],
      [50, 7.35],
      [60, 8.82],
      [70, 10.29],
      [80, 11.76],
      [90, 13.23]
    ];
    for (const [pct, expectedGross] of cases) {
      const result = runBypassScenario({ disruptionPct: pct });
      expect(result.grossDisruptedMbpd).toBe(expectedGross);
    }
  });

  it("rounds the net daily deficit without leaking artifacts", () => {
    // 80% disruption: gross = 11.76, postBypass = 8.16, IEA = 4, net = 4.16
    const result = runBypassScenario({ disruptionPct: 80 });
    expect(result.grossDisruptedMbpd).toBe(11.76);
    expect(result.postBypassDeficitMbpd).toBe(8.16);
    expect(result.netDailyDeficitMbpd).toBe(4.16);
  });
});

// ===========================================================================
// Override constants — sensitivity testing
// ===========================================================================

describe("runBypassScenario — override constants", () => {
  it("merges partial overrides onto the baseline", () => {
    const result = runBypassScenario({
      disruptionPct: 100,
      overrides: { hormuzCrudeFlowMbpd: 20 }
    });
    expect(result.constants.hormuzCrudeFlowMbpd).toBe(20);
    expect(result.constants.saudiSpareCapacityMbpd).toBe(SAUDI_SPARE_CAPACITY_MBPD);
    expect(result.constants.ieaMaxRateMbpd).toBe(IEA_MAX_RATE_MBPD);
    expect(result.grossDisruptedMbpd).toBe(20);
  });

  it("respects override of operational minimum (zero buffer = immediate breach)", () => {
    const result = runBypassScenario({
      disruptionPct: 100,
      overrides: { operationalMinimumMb: 968 } // buffer = 0
    });
    expect(result.state).toBe("DEPLETING");
    expect(result.daysToOperationalMinimum).toBe(0);
  });
});

// ===========================================================================
// IEA cumulative cap simulator — Dynamic IEA Constraint
// ===========================================================================

describe("simulateIeaDrawdown — dynamic IEA cumulative cap", () => {
  it("caps cumulative release at 400 mb regardless of horizon length", () => {
    // 4.0 mbpd × 200 days = 800 mb naive, but governance cap is 400.
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: 4,
      horizonDays: 200
    });
    expect(result.capReached).toBe(true);
    expect(result.cumulativeReleaseMb).toBe(400);
    expect(result.daysToCapReached).toBe(100);
    expect(result.effectiveDailyReleaseMbpd).toBe(4);
  });

  it("returns uncapped cumulative when horizon is shorter than cap runway", () => {
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: 2,
      horizonDays: 50
    });
    expect(result.capReached).toBe(false);
    expect(result.cumulativeReleaseMb).toBe(100);
    expect(result.daysToCapReached).toBe(200);
  });

  it("clamps the daily rate at the IEA_MAX_RATE hydraulic ceiling", () => {
    // Requesting 10 mbpd is hydraulically impossible — must clamp to 4.
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: 10,
      horizonDays: 1
    });
    expect(result.effectiveDailyReleaseMbpd).toBe(4);
    expect(result.cumulativeReleaseMb).toBe(4);
  });

  it("returns zero release when requested rate is zero", () => {
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: 0,
      horizonDays: 100
    });
    expect(result.cumulativeReleaseMb).toBe(0);
    expect(result.capReached).toBe(false);
    expect(result.daysToCapReached).toBeNull();
    expect(result.effectiveDailyReleaseMbpd).toBe(0);
  });

  it("clamps negative requested rates to zero (no negative cumulative)", () => {
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: -5,
      horizonDays: 100
    });
    expect(result.effectiveDailyReleaseMbpd).toBe(0);
    expect(result.cumulativeReleaseMb).toBe(0);
    expect(result.capReached).toBe(false);
  });

  it("hits the cap exactly when horizon × rate = cap", () => {
    // 2 mbpd × 200 days = 400 mb exactly.
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: 2,
      horizonDays: 200
    });
    expect(result.capReached).toBe(true);
    expect(result.cumulativeReleaseMb).toBe(400);
    expect(result.daysToCapReached).toBe(200);
  });

  it("respects custom cumulative cap and max rate overrides", () => {
    const result = simulateIeaDrawdown({
      dailyReleaseRateMbpd: 3,
      horizonDays: 100,
      cumulativeCapMb: 200,
      maxDailyRateMbpd: 5
    });
    expect(result.effectiveDailyReleaseMbpd).toBe(3);
    expect(result.capReached).toBe(true);
    expect(result.cumulativeReleaseMb).toBe(200);
    expect(result.daysToCapReached).toBeCloseTo(66.67, 2);
  });
});
