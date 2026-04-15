import { describe, expect, it } from "vitest";
import {
  ALIGNMENT_TOLERANCE_USD,
  BACKWARDATION_CURVATURE_K,
  EQUILIBRIUM_BREACH_HORIZON_DAYS,
  FUTURES_CURVE_MONTH_COUNT,
  PEACETIME_CONTANGO_STEP_USD,
  PEACETIME_PROMPT_USD,
  buildFuturesCurve,
  buildPeacetimeBenchmark,
  classifyRegime,
  computeCurveShape,
  computeFuturesCurveAlpha,
  computeLongDatedAnchor,
  computePromptPrice,
  computeStressScore,
  inferDaysToBreachFromM1,
  runFuturesCurveScenario
} from "./futuresCurveModel";
import type { BypassModelResult } from "./bypassModel";

describe("stress scoring", () => {
  it("returns 0 for null / no breach", () => {
    expect(computeStressScore(null)).toBe(0);
    expect(computeStressScore(EQUILIBRIUM_BREACH_HORIZON_DAYS)).toBe(0);
    expect(computeStressScore(EQUILIBRIUM_BREACH_HORIZON_DAYS + 50)).toBe(0);
  });

  it("returns 1 for immediate breach (<= 0 days)", () => {
    expect(computeStressScore(0)).toBe(1);
    expect(computeStressScore(-5)).toBe(1);
  });

  it("rises monotonically as daysToBreach shrinks", () => {
    const s180 = computeStressScore(180);
    const s120 = computeStressScore(120);
    const s60 = computeStressScore(60);
    const s15 = computeStressScore(15);

    expect(s180).toBe(0);
    expect(s120).toBeGreaterThan(s180);
    expect(s60).toBeGreaterThan(s120);
    expect(s15).toBeGreaterThan(s60);
    expect(s15).toBeLessThan(1);
  });
});

describe("regime classification", () => {
  it("null or >= 180 days is equilibrium", () => {
    expect(classifyRegime(null)).toBe("EQUILIBRIUM");
    expect(classifyRegime(200)).toBe("EQUILIBRIUM");
    expect(classifyRegime(180)).toBe("EQUILIBRIUM");
  });

  it("90..180 is mild backwardation", () => {
    expect(classifyRegime(179)).toBe("MILD_BACKWARDATION");
    expect(classifyRegime(120)).toBe("MILD_BACKWARDATION");
    expect(classifyRegime(90)).toBe("MILD_BACKWARDATION");
  });

  it("30..90 is moderate backwardation", () => {
    expect(classifyRegime(89)).toBe("MODERATE_BACKWARDATION");
    expect(classifyRegime(60)).toBe("MODERATE_BACKWARDATION");
    expect(classifyRegime(30)).toBe("MODERATE_BACKWARDATION");
  });

  it("< 30 is severe backwardation", () => {
    expect(classifyRegime(29)).toBe("SEVERE_BACKWARDATION");
    expect(classifyRegime(15)).toBe("SEVERE_BACKWARDATION");
    expect(classifyRegime(0)).toBe("SEVERE_BACKWARDATION");
    expect(classifyRegime(-10)).toBe("SEVERE_BACKWARDATION");
  });
});

describe("prompt-month pricing hits the spec endpoints", () => {
  it("peacetime prompt is $80", () => {
    expect(computePromptPrice(null)).toBe(PEACETIME_PROMPT_USD);
    expect(computePromptPrice(200)).toBe(80);
    expect(computePromptPrice(180)).toBe(80);
  });

  it("mild endpoint at 90 days lands at $85", () => {
    expect(computePromptPrice(90)).toBe(85);
  });

  it("moderate endpoint at 30 days lands at $105", () => {
    expect(computePromptPrice(30)).toBe(105);
  });

  it("severe endpoint at 0 days lands at $150", () => {
    expect(computePromptPrice(0)).toBe(150);
  });

  it("hard-caps the prompt at $150 even under pathological input", () => {
    expect(computePromptPrice(-50)).toBe(150);
  });

  it("rises monotonically as daysToBreach shrinks", () => {
    const p180 = computePromptPrice(180);
    const p120 = computePromptPrice(120);
    const p60 = computePromptPrice(60);
    const p15 = computePromptPrice(15);
    const p0 = computePromptPrice(0);

    expect(p120).toBeGreaterThan(p180);
    expect(p60).toBeGreaterThan(p120);
    expect(p15).toBeGreaterThan(p60);
    expect(p0).toBeGreaterThan(p15);
  });
});

describe("long-dated anchor stays tame and rises slowly", () => {
  it("peacetime anchor matches M12 contango endpoint", () => {
    const expected =
      PEACETIME_PROMPT_USD +
      PEACETIME_CONTANGO_STEP_USD * (FUTURES_CURVE_MONTH_COUNT - 1);
    expect(computeLongDatedAnchor(null)).toBe(expected);
    expect(computeLongDatedAnchor(180)).toBe(expected);
  });

  it("rises from 81.1 at 180 days to 85 at 0 days", () => {
    expect(computeLongDatedAnchor(180)).toBe(81.1);
    expect(computeLongDatedAnchor(90)).toBe(81.5);
    expect(computeLongDatedAnchor(30)).toBe(83);
    expect(computeLongDatedAnchor(0)).toBe(85);
  });

  it("anchor stays below the prompt once we leave equilibrium", () => {
    // At equilibrium (180 days) the curve is in peacetime contango —
    // anchor $81.10 is legitimately ABOVE prompt $80.00. The inversion
    // only kicks in once backwardation takes over.
    for (const days of [120, 90, 60, 30, 15, 0]) {
      expect(computeLongDatedAnchor(days)).toBeLessThan(computePromptPrice(days));
    }
  });
});

describe("peacetime benchmark (static overlay line)", () => {
  it("has 12 points in flat contango", () => {
    const benchmark = buildPeacetimeBenchmark();
    expect(benchmark).toHaveLength(FUTURES_CURVE_MONTH_COUNT);
    expect(benchmark[0]).toEqual({ month: 1, priceUsd: 80 });
    expect(benchmark[11]).toEqual({ month: 12, priceUsd: 81.1 });
  });

  it("is monotonically non-decreasing (positive contango)", () => {
    const benchmark = buildPeacetimeBenchmark();
    for (let i = 1; i < benchmark.length; i++) {
      expect(benchmark[i].priceUsd).toBeGreaterThanOrEqual(
        benchmark[i - 1].priceUsd
      );
    }
  });
});

describe("computeCurveShape — backwardation shape", () => {
  it("equilibrium produces pure contango matching the benchmark", () => {
    const curve = computeCurveShape(80, 81.1, 0, "EQUILIBRIUM");
    expect(curve[0].priceUsd).toBeCloseTo(80, 1);
    expect(curve[11].priceUsd).toBeCloseTo(81.1, 1);
    // Monotonic up
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].priceUsd).toBeGreaterThanOrEqual(curve[i - 1].priceUsd);
    }
  });

  it("severe endpoint drops from 150 to ~85, passing near 100 at M6", () => {
    const curve = computeCurveShape(150, 85, 1, "SEVERE_BACKWARDATION");
    expect(curve[0].priceUsd).toBe(150);
    expect(curve[11].priceUsd).toBe(85);
    // M6 should land in the spec's "~$100" neighbourhood. The calibration
    // target is 100, the exponential decay at k=0.3 actually gives ≈97.5.
    // We assert a loose window so small curvature tweaks don't break CI.
    expect(curve[5].priceUsd).toBeGreaterThan(92);
    expect(curve[5].priceUsd).toBeLessThan(105);
  });

  it("backwardated curves are monotonically non-increasing", () => {
    const mild = computeCurveShape(85, 81.5, 0.5, "MILD_BACKWARDATION");
    const severe = computeCurveShape(150, 85, 1, "SEVERE_BACKWARDATION");

    for (const curve of [mild, severe]) {
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].priceUsd).toBeLessThanOrEqual(curve[i - 1].priceUsd);
      }
    }
  });

  it("severe curve has a visibly wider M1-M12 spread than mild", () => {
    const mild = computeCurveShape(85, 81.5, 0.5, "MILD_BACKWARDATION");
    const severe = computeCurveShape(150, 85, 1, "SEVERE_BACKWARDATION");

    const mildSpread = mild[0].priceUsd - mild[11].priceUsd;
    const severeSpread = severe[0].priceUsd - severe[11].priceUsd;

    expect(severeSpread).toBeGreaterThan(mildSpread * 5);
  });
});

describe("buildFuturesCurve end-to-end", () => {
  it("equilibrium result mirrors the peacetime benchmark", () => {
    const result = buildFuturesCurve(null);
    expect(result.regime).toBe("EQUILIBRIUM");
    expect(result.stressScore).toBe(0);
    expect(result.promptPriceUsd).toBe(80);
    expect(result.curve[0].priceUsd).toBe(80);
    expect(result.curve[11].priceUsd).toBeCloseTo(81.1, 1);
    // The scenario curve should overlap the benchmark at equilibrium
    result.curve.forEach((point, index) => {
      expect(point.priceUsd).toBeCloseTo(result.benchmark[index].priceUsd, 1);
    });
  });

  it("mild depletion (120 days) produces shallow backwardation", () => {
    const result = buildFuturesCurve(120);
    expect(result.regime).toBe("MILD_BACKWARDATION");
    expect(result.promptPriceUsd).toBeGreaterThan(80);
    expect(result.promptPriceUsd).toBeLessThan(90);
    expect(result.m1MinusM12Usd).toBeGreaterThan(0);
    expect(result.m1MinusM12Usd).toBeLessThan(6);
  });

  it("severe depletion (15 days) produces extreme front-loaded backwardation", () => {
    const result = buildFuturesCurve(15);
    expect(result.regime).toBe("SEVERE_BACKWARDATION");
    expect(result.promptPriceUsd).toBeGreaterThan(110);
    // M1 should tower over M12
    expect(result.m1MinusM12Usd).toBeGreaterThan(25);
    // Long-dated still anchored below 90
    expect(result.longDatedPriceUsd).toBeLessThan(90);
  });

  it("always returns a 12-point curve with matching benchmark length", () => {
    for (const days of [null, 250, 180, 120, 60, 30, 5, 0, -10]) {
      const result = buildFuturesCurve(days);
      expect(result.curve).toHaveLength(FUTURES_CURVE_MONTH_COUNT);
      expect(result.benchmark).toHaveLength(FUTURES_CURVE_MONTH_COUNT);
    }
  });
});

describe("runFuturesCurveScenario adapter", () => {
  it("passes daysToOperationalMinimum through to the builder", () => {
    const bypass: Pick<
      BypassModelResult,
      "daysToOperationalMinimum" | "netDailyDeficitMbpd" | "state"
    > = {
      daysToOperationalMinimum: 15,
      netDailyDeficitMbpd: 3.2,
      state: "DEPLETING"
    };
    const result = runFuturesCurveScenario(bypass);
    expect(result.daysToBreach).toBe(15);
    expect(result.regime).toBe("SEVERE_BACKWARDATION");
  });

  it("accepts null daysToBreach (equilibrium state from bypass model)", () => {
    const bypass: Pick<
      BypassModelResult,
      "daysToOperationalMinimum" | "netDailyDeficitMbpd" | "state"
    > = {
      daysToOperationalMinimum: null,
      netDailyDeficitMbpd: 0,
      state: "EQUILIBRIUM"
    };
    const result = runFuturesCurveScenario(bypass);
    expect(result.regime).toBe("EQUILIBRIUM");
    expect(result.m1MinusM12Usd).toBeLessThanOrEqual(0);
  });
});

describe("inferDaysToBreachFromM1 (bisection inverse of computePromptPrice)", () => {
  it("peacetime price rounds to the equilibrium horizon", () => {
    expect(inferDaysToBreachFromM1(80)).toBe(EQUILIBRIUM_BREACH_HORIZON_DAYS);
  });

  it("sub-peacetime price returns null", () => {
    expect(inferDaysToBreachFromM1(78)).toBeNull();
  });

  it("severe cap price rounds to zero days", () => {
    expect(inferDaysToBreachFromM1(150)).toBe(0);
    expect(inferDaysToBreachFromM1(165)).toBe(0);
  });

  it("round-trips each regime endpoint within 1 day", () => {
    const anchors = [
      { days: 180, price: 80 },
      { days: 135, price: computePromptPrice(135) },
      { days: 90, price: 85 },
      { days: 60, price: computePromptPrice(60) },
      { days: 30, price: 105 },
      { days: 15, price: computePromptPrice(15) }
    ];
    for (const anchor of anchors) {
      const implied = inferDaysToBreachFromM1(anchor.price);
      expect(implied).not.toBeNull();
      expect(Math.abs((implied as number) - anchor.days)).toBeLessThan(1);
    }
  });

  it("monotonically decreasing — higher observed price implies fewer days", () => {
    const d85 = inferDaysToBreachFromM1(85) as number;
    const d95 = inferDaysToBreachFromM1(95) as number;
    const d115 = inferDaysToBreachFromM1(115) as number;
    const d140 = inferDaysToBreachFromM1(140) as number;

    expect(d85).toBeGreaterThan(d95);
    expect(d95).toBeGreaterThan(d115);
    expect(d115).toBeGreaterThan(d140);
  });
});

describe("computeFuturesCurveAlpha (observed-vs-model comparator)", () => {
  it("classifies ALIGNED when observed M1 hugs the model M1", () => {
    const modelResult = buildFuturesCurve(null); // equilibrium, M1 = $80
    const alpha = computeFuturesCurveAlpha(modelResult, 80.2);

    expect(alpha.classification).toBe("ALIGNED");
    expect(Math.abs(alpha.deltaM1Usd)).toBeLessThan(ALIGNMENT_TOLERANCE_USD);
    expect(alpha.narrative).toMatch(/aligned/i);
  });

  it("classifies UNDERPRICED when observed M1 is well below model M1", () => {
    // Severe physical scenario — model says $150. Market says $92.30.
    const modelResult = buildFuturesCurve(0);
    const alpha = computeFuturesCurveAlpha(modelResult, 92.3);

    expect(alpha.classification).toBe("UNDERPRICED");
    expect(alpha.deltaM1Usd).toBeLessThan(-1);
    expect(alpha.modelM1Usd).toBe(150);
    expect(alpha.observedM1Usd).toBe(92.3);
    expect(alpha.narrative).toMatch(/UNDERPRICING/);
  });

  it("classifies OVERPRICED when observed M1 is well above model M1", () => {
    // Physical equilibrium — model says $80. Market bidding $92.30 (moderate risk).
    const modelResult = buildFuturesCurve(null);
    const alpha = computeFuturesCurveAlpha(modelResult, 92.3);

    expect(alpha.classification).toBe("OVERPRICED");
    expect(alpha.deltaM1Usd).toBeGreaterThan(1);
    expect(alpha.narrative).toMatch(/OVERPRICING/);
  });

  it("narrative mentions both model and implied breach horizons when both exist", () => {
    const modelResult = buildFuturesCurve(15); // severe, model M1 ~128
    const alpha = computeFuturesCurveAlpha(modelResult, 92.3);

    expect(alpha.narrative).toMatch(/15d/);
    expect(alpha.impliedDaysToBreach).not.toBeNull();
    // 92.30 sits in the moderate band — implied days should be ~60-80.
    expect(alpha.impliedDaysToBreach!).toBeGreaterThan(40);
    expect(alpha.impliedDaysToBreach!).toBeLessThan(90);
  });

  it("handles sub-peacetime observed M1 without crashing", () => {
    const modelResult = buildFuturesCurve(null);
    const alpha = computeFuturesCurveAlpha(modelResult, 76);

    expect(alpha.impliedDaysToBreach).toBeNull();
    expect(alpha.narrative).toMatch(/sub-peacetime/);
  });
});

describe("calibration constant sanity", () => {
  it("BACKWARDATION_CURVATURE_K is in the expected window", () => {
    expect(BACKWARDATION_CURVATURE_K).toBeGreaterThan(0.2);
    expect(BACKWARDATION_CURVATURE_K).toBeLessThan(0.5);
  });
});
