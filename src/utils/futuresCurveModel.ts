/**
 * Futures Curve Model — The Missing Y-Axis
 * ========================================
 *
 * Pure-TypeScript deterministic model for the question:
 *
 *   "Given the physical scenario the bypass modeler just computed, what
 *    shape does ICE Brent's forward curve take?"
 *
 * This is the paper-market projection of the physical deficit. The bypass
 * modeler says *when* inventories breach the operational minimum; this
 * module says *how violently the prompt month should spike* to enforce
 * the demand destruction that closes the gap.
 *
 * The math is calibrated to the three regime endpoints specified in the
 * Phase 1 execution plan:
 *
 *   - Equilibrium (no breach / breach >= 180 days)
 *       M1 ≈ $80.00, slight contango, M12 ≈ $81.10
 *       The peacetime "flat-ish" curve. A 10 cent/month contango
 *       approximates storage + financing carry.
 *
 *   - Mild depletion (breach ~90 days)
 *       M1 ≈ $85, M6 ≈ $80
 *       Shallow backwardation as the physical market starts pricing in
 *       near-term tightness. Long-dated is still anchored.
 *
 *   - Severe depletion (breach <30 days, heading to zero)
 *       M1 ≈ $150, M6 ≈ $100, M12 ≈ $85
 *       Extreme front-loaded backwardation. The prompt spikes to
 *       enforce demand destruction; deferred months remain anchored to
 *       the long-term risk-premium equilibrium.
 *
 * In between those endpoints the curve is driven by a continuous
 * "stress score" in [0, 1] derived from daysToBreach. The stress score
 * drives three things:
 *
 *   1. The prompt-month price (piecewise-smooth from $80 to $150).
 *   2. The long-dated anchor (rises from $81 peacetime to ~$88 under
 *      severe stress — long-dated geopolitical risk premium).
 *   3. The shape of the exponential decay between prompt and long-dated.
 *      The curvature parameter k is held constant at ~0.3 — calibrated so
 *      the severe endpoint (prompt=$150, anchor=$85) lands M6 at ~$100,
 *      matching the spec example. Front-loaded severity comes from the
 *      *level difference* between prompt and anchor, not from cranking
 *      curvature.
 *
 * All of this lives here as pure functions. React components consume
 * `runFuturesCurveScenario()` output and never recompute independently —
 * the same single-source-of-truth rule as the bypass modeler.
 */

import type { BypassModelResult } from "./bypassModel";

// ---------------------------------------------------------------------------
// Baseline constants (peacetime equilibrium — April 2026 snapshot)
// ---------------------------------------------------------------------------

/** Peacetime M1 price ($/bbl). Anchored to a typical equilibrium Brent print. */
export const PEACETIME_PROMPT_USD = 80;

/**
 * Peacetime per-month contango carry ($/bbl). 10 cents/month approximates
 * storage + financing costs on a Gulf-to-Europe barrel. Gives a M12 ≈ $81.10.
 */
export const PEACETIME_CONTANGO_STEP_USD = 0.1;

/**
 * Stress horizon in days. At or above this many days-to-breach the scenario
 * is treated as equilibrium. Chosen at 180 because the six-month forward is
 * typically where physical effects fade into long-term fundamentals.
 */
export const EQUILIBRIUM_BREACH_HORIZON_DAYS = 180;

/** Total contract months plotted on the curve. */
export const FUTURES_CURVE_MONTH_COUNT = 12;

/**
 * Exponential decay parameter k for the backwardated-curve shape.
 * Calibrated against the severe-regime spec:
 *
 *   prompt=$150, anchor=$85, want M6≈$100
 *   → decay(5) ≈ (100-85)/(150-85) ≈ 0.231
 *   → k ≈ 0.30 solves that with the normalized-decay formula below
 *
 * Held constant across all backwardated regimes so the curve shape
 * reads consistently whether stress is mild or severe — the width of
 * the spread is what changes, not the curvature signature.
 */
export const BACKWARDATION_CURVATURE_K = 0.3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FuturesCurvePoint {
  /** 1-indexed contract month. M1 is prompt, M12 is the twelfth forward. */
  month: number;
  /** Implied settlement price in USD/bbl, rounded to 0.01 cents. */
  priceUsd: number;
}

export type FuturesCurveRegime =
  | "EQUILIBRIUM"
  | "MILD_BACKWARDATION"
  | "MODERATE_BACKWARDATION"
  | "SEVERE_BACKWARDATION";

export interface FuturesCurveResult {
  /** 12-month curve. Always length === FUTURES_CURVE_MONTH_COUNT. */
  curve: FuturesCurvePoint[];
  /** Static peacetime benchmark for the split-screen comparison overlay. */
  benchmark: FuturesCurvePoint[];
  /** Classification bucket — drives tone/label in the chart legend. */
  regime: FuturesCurveRegime;
  /** Normalized stress in [0, 1]. 0 = equilibrium, 1 = breach imminent. */
  stressScore: number;
  /** Front-month price for quick readouts. */
  promptPriceUsd: number;
  /** Twelfth-month (long-dated) price for quick readouts. */
  longDatedPriceUsd: number;
  /** M1 - M12 spread. Positive = backwardation, negative = contango. */
  m1MinusM12Usd: number;
  /** Echo of the driving input for debug/display. */
  daysToBreach: number | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a full futures curve result from a bypass-model output.
 *
 * This is the intended entry point for React code: feed it the
 * `BypassModelResult` you already have on hand and get back everything the
 * chart needs to render, including the static benchmark curve for the
 * split-screen overlay.
 *
 * Pure, deterministic, safe to call inside useMemo.
 */
export function runFuturesCurveScenario(
  bypassResult: Pick<
    BypassModelResult,
    "daysToOperationalMinimum" | "netDailyDeficitMbpd" | "state"
  >
): FuturesCurveResult {
  return buildFuturesCurve(bypassResult.daysToOperationalMinimum);
}

/**
 * Lower-level entry point: build a curve directly from a days-to-breach
 * value. Exposed so unit tests can exercise the regime branches without
 * constructing a full BypassModelResult.
 *
 * `daysToBreach === null` is interpreted as "not depleting" (equilibrium).
 */
export function buildFuturesCurve(
  daysToBreach: number | null
): FuturesCurveResult {
  const stressScore = computeStressScore(daysToBreach);
  const regime = classifyRegime(daysToBreach);
  const promptPriceUsd = computePromptPrice(daysToBreach);
  const longDatedPriceUsd = computeLongDatedAnchor(daysToBreach);
  const curve = computeCurveShape(
    promptPriceUsd,
    longDatedPriceUsd,
    stressScore,
    regime
  );
  const benchmark = buildPeacetimeBenchmark();
  const m1MinusM12Usd = round2(promptPriceUsd - longDatedPriceUsd);

  return {
    curve,
    benchmark,
    regime,
    stressScore,
    promptPriceUsd,
    longDatedPriceUsd,
    m1MinusM12Usd,
    daysToBreach
  };
}

/**
 * The dashed-gray reference line. Always the same — M1=$80.00 with a flat
 * 10-cent monthly carry — regardless of scenario state. Exported because
 * the chart renders it as a static overlay alongside the live scenario.
 */
export function buildPeacetimeBenchmark(): FuturesCurvePoint[] {
  return Array.from({ length: FUTURES_CURVE_MONTH_COUNT }, (_, index) => ({
    month: index + 1,
    priceUsd: round2(PEACETIME_PROMPT_USD + PEACETIME_CONTANGO_STEP_USD * index)
  }));
}

// ---------------------------------------------------------------------------
// Stress scoring
// ---------------------------------------------------------------------------

/**
 * Map daysToBreach to a stress score in [0, 1].
 *
 *   null or >= 180  →  0.0 (equilibrium)
 *   <= 0            →  1.0 (immediate breach)
 *   else            →  linear interpolation 180→0 = 0→1
 *
 * The stress score is NOT directly used to compute prices — those use
 * their own piecewise curves calibrated to the spec endpoints. It's
 * exposed for the chart legend and for driving the curvature parameter.
 */
export function computeStressScore(daysToBreach: number | null): number {
  if (daysToBreach === null) {
    return 0;
  }
  if (daysToBreach >= EQUILIBRIUM_BREACH_HORIZON_DAYS) {
    return 0;
  }
  if (daysToBreach <= 0) {
    return 1;
  }
  return round3(1 - daysToBreach / EQUILIBRIUM_BREACH_HORIZON_DAYS);
}

/**
 * Classify the curve into one of four regimes based on daysToBreach.
 * The thresholds match the execution-plan spec:
 *
 *   breach >= 180 or null  →  EQUILIBRIUM
 *   breach 90..180         →  MILD_BACKWARDATION
 *   breach 30..90          →  MODERATE_BACKWARDATION
 *   breach < 30            →  SEVERE_BACKWARDATION
 */
export function classifyRegime(
  daysToBreach: number | null
): FuturesCurveRegime {
  if (daysToBreach === null || daysToBreach >= EQUILIBRIUM_BREACH_HORIZON_DAYS) {
    return "EQUILIBRIUM";
  }
  if (daysToBreach >= 90) {
    return "MILD_BACKWARDATION";
  }
  if (daysToBreach >= 30) {
    return "MODERATE_BACKWARDATION";
  }
  return "SEVERE_BACKWARDATION";
}

// ---------------------------------------------------------------------------
// Prompt-month pricing
// ---------------------------------------------------------------------------

/**
 * Compute the prompt (M1) price as a function of daysToBreach.
 *
 * Piecewise-smooth calibration to the three spec endpoints:
 *
 *   180+ days:  $80.00  (peacetime)
 *    90 days:   $85.00  (mild: +$5 over peacetime)
 *    30 days:  $105.00  (moderate: +$20 over peacetime)
 *     0 days:  $150.00  (severe: +$70 over peacetime)
 *
 * Linear inside each regime band, quadratic inside the severe band so
 * the curve accelerates as breach imminence rises. The quadratic is
 * bounded — we hard-cap at $150 to prevent overshooting on pathological
 * inputs (e.g., large negative daysToBreach from model edge cases).
 */
export function computePromptPrice(daysToBreach: number | null): number {
  if (daysToBreach === null || daysToBreach >= EQUILIBRIUM_BREACH_HORIZON_DAYS) {
    return PEACETIME_PROMPT_USD;
  }
  if (daysToBreach >= 90) {
    // Mild band: 180 → 80, 90 → 85 (linear).
    const t = (EQUILIBRIUM_BREACH_HORIZON_DAYS - daysToBreach) / 90;
    return round2(PEACETIME_PROMPT_USD + t * 5);
  }
  if (daysToBreach >= 30) {
    // Moderate band: 90 → 85, 30 → 105 (linear).
    const t = (90 - daysToBreach) / 60;
    return round2(85 + t * 20);
  }
  // Severe band: 30 → 105, 0 → 150 (quadratic for front-loaded spike).
  const clampedDays = Math.max(0, daysToBreach);
  const t = (30 - clampedDays) / 30; // 0 at 30 days, 1 at 0 days
  const premium = t * t * 45;
  return round2(Math.min(150, 105 + premium));
}

/**
 * Long-dated anchor (M12) price as a function of daysToBreach.
 *
 * Stays close to the peacetime $81 level under mild/moderate stress
 * because the deferred months price the post-crisis equilibrium rather
 * than the near-term physical deficit. Rises to ~$88 in the severe band
 * — a long-term geopolitical risk premium embedded in the curve.
 *
 * Spec endpoints:
 *
 *   180+ days:  $81.10 (peacetime contango endpoint, matches benchmark)
 *    90 days:   $81.50
 *    30 days:   $83.00
 *     0 days:   $85.00 (capped — deferred months resist more than this)
 *
 * These numbers are deliberately tame. A curve where M12 triples under
 * stress would imply the market expects the disruption to be permanent,
 * which is not what a spike-and-recover scenario looks like.
 */
export function computeLongDatedAnchor(daysToBreach: number | null): number {
  const peacetimeAnchor =
    PEACETIME_PROMPT_USD +
    PEACETIME_CONTANGO_STEP_USD * (FUTURES_CURVE_MONTH_COUNT - 1);

  if (daysToBreach === null || daysToBreach >= EQUILIBRIUM_BREACH_HORIZON_DAYS) {
    return round2(peacetimeAnchor);
  }
  if (daysToBreach >= 90) {
    // Mild: 180 → 81.1, 90 → 81.5
    const t = (EQUILIBRIUM_BREACH_HORIZON_DAYS - daysToBreach) / 90;
    return round2(peacetimeAnchor + t * 0.4);
  }
  if (daysToBreach >= 30) {
    // Moderate: 90 → 81.5, 30 → 83
    const t = (90 - daysToBreach) / 60;
    return round2(81.5 + t * 1.5);
  }
  // Severe: 30 → 83, 0 → 85 (linear — long-dated doesn't accelerate)
  const clampedDays = Math.max(0, daysToBreach);
  const t = (30 - clampedDays) / 30;
  return round2(83 + t * 2);
}

// ---------------------------------------------------------------------------
// Curve shape between prompt and long-dated
// ---------------------------------------------------------------------------

/**
 * Given a prompt price, a long-dated anchor, a stress score, and a regime,
 * build the full 12-month curve.
 *
 * Equilibrium mode uses a linear contango from M1 to the anchor.
 *
 * Backwardated modes use a normalized exponential decay:
 *
 *   decay(m) = (e^(-k*(m-1)) - e^(-11k)) / (1 - e^(-11k))
 *
 * with decay(1) = 1 and decay(12) = 0. The curvature parameter k is
 * held at BACKWARDATION_CURVATURE_K (~0.3), calibrated so the severe
 * endpoint (prompt=$150, anchor=$85) lands M6 ≈ $100 as specified.
 *
 * We deliberately do NOT scale k with stress. Front-loaded severity at
 * high stress comes from the widening gap between prompt and anchor;
 * the curve's *shape* stays recognisable across regimes so a trader
 * reading the chart sees the same visual grammar whether the scenario
 * is mild or severe.
 */
export function computeCurveShape(
  promptPriceUsd: number,
  longDatedPriceUsd: number,
  _stressScore: number,
  regime: FuturesCurveRegime
): FuturesCurvePoint[] {
  if (regime === "EQUILIBRIUM") {
    // Pure contango from M1 to M12. Matches the benchmark shape but
    // allows for any future "equilibrium ≠ peacetime" drift (e.g.
    // structural shifts in OPEC+ policy shifting the whole curve).
    const step =
      (longDatedPriceUsd - promptPriceUsd) / (FUTURES_CURVE_MONTH_COUNT - 1);
    return Array.from({ length: FUTURES_CURVE_MONTH_COUNT }, (_, index) => ({
      month: index + 1,
      priceUsd: round2(promptPriceUsd + step * index)
    }));
  }

  const k = BACKWARDATION_CURVATURE_K;
  const denom = 1 - Math.exp(-k * (FUTURES_CURVE_MONTH_COUNT - 1));

  return Array.from({ length: FUTURES_CURVE_MONTH_COUNT }, (_, index) => {
    const monthIndex = index; // 0-based for the decay function
    const rawDecay =
      (Math.exp(-k * monthIndex) -
        Math.exp(-k * (FUTURES_CURVE_MONTH_COUNT - 1))) /
      denom;
    const priceUsd =
      longDatedPriceUsd + (promptPriceUsd - longDatedPriceUsd) * rawDecay;

    return {
      month: index + 1,
      priceUsd: round2(priceUsd)
    };
  });
}

// ---------------------------------------------------------------------------
// Observed-vs-model comparison (the "alpha" math)
// ---------------------------------------------------------------------------

/**
 * Direction of the observed-vs-model delta. Tells the UI which tonal
 * badge to render without re-deriving the classification.
 *
 *   UNDERPRICED — model M1 > observed M1. The physical model thinks the
 *                 paper market is asleep to the deficit.
 *   OVERPRICED  — model M1 < observed M1. The physical model thinks the
 *                 market is bidding more risk than the plumbing implies.
 *   ALIGNED     — |delta| below ALIGNMENT_TOLERANCE_USD. Within noise.
 */
export type FuturesCurveAlphaClassification =
  | "UNDERPRICED"
  | "OVERPRICED"
  | "ALIGNED";

export interface FuturesCurveAlpha {
  /** Model-implied M1 price (USD/bbl). */
  modelM1Usd: number;
  /** Observed ICE Brent M1 settlement (USD/bbl). */
  observedM1Usd: number;
  /** observedM1 − modelM1. Positive means the market is above the model. */
  deltaM1Usd: number;
  /**
   * The daysToBreach value that, fed through `computePromptPrice`, would
   * reproduce the observed M1. Back-solved by bisection over [0, 365].
   * `null` when the observed M1 is below the peacetime floor ($80), i.e.
   * the market disagrees with the peacetime equilibrium itself.
   */
  impliedDaysToBreach: number | null;
  /** Echo of the physical-model daysToBreach for side-by-side readouts. */
  modelDaysToBreach: number | null;
  /** UNDERPRICED / OVERPRICED / ALIGNED — drives the alpha badge tone. */
  classification: FuturesCurveAlphaClassification;
  /** Full plain-English trader blurb rendered in the dashboard. */
  narrative: string;
}

/** Below this absolute spread ($/bbl) we call model and market aligned. */
export const ALIGNMENT_TOLERANCE_USD = 0.75;

/**
 * Upper bound for the implied-days bisection. We don't care about values
 * above equilibrium because `computePromptPrice` saturates at 80 there,
 * and 365 gives a cushion above `EQUILIBRIUM_BREACH_HORIZON_DAYS = 180`.
 */
const IMPLIED_DAYS_BISECTION_UPPER_BOUND = 365;
const IMPLIED_DAYS_BISECTION_ITERATIONS = 40;

/**
 * Core comparator. Given the physical-model result and the observed ICE
 * M1 settlement, compute every number the "alpha" readout needs to
 * render. Pure — no React, no fetches — so it's trivially unit testable.
 */
export function computeFuturesCurveAlpha(
  modelResult: FuturesCurveResult,
  observedM1Usd: number
): FuturesCurveAlpha {
  const modelM1Usd = modelResult.promptPriceUsd;
  const deltaM1Usd = round2(observedM1Usd - modelM1Usd);
  const impliedDaysToBreach = inferDaysToBreachFromM1(observedM1Usd);

  const classification: FuturesCurveAlphaClassification =
    Math.abs(deltaM1Usd) < ALIGNMENT_TOLERANCE_USD
      ? "ALIGNED"
      : deltaM1Usd < 0
        ? "UNDERPRICED"
        : "OVERPRICED";

  const narrative = buildAlphaNarrative({
    classification,
    deltaM1Usd,
    modelDaysToBreach: modelResult.daysToBreach,
    impliedDaysToBreach
  });

  return {
    modelM1Usd,
    observedM1Usd: round2(observedM1Usd),
    deltaM1Usd,
    impliedDaysToBreach,
    modelDaysToBreach: modelResult.daysToBreach,
    classification,
    narrative
  };
}

/**
 * Back-solve `computePromptPrice` for the daysToBreach that would yield
 * the given prompt price. The piecewise function is monotonic-decreasing
 * in daysToBreach, so bisection converges cleanly.
 *
 * Edge cases:
 *   - observedM1 <= PEACETIME_PROMPT_USD  →  return 180 (equilibrium cap)
 *     if equal to peacetime, null if strictly below (market disagrees
 *     with the model's floor entirely).
 *   - observedM1 >= $150                   →  return 0 (severe cap)
 */
export function inferDaysToBreachFromM1(priceUsd: number): number | null {
  if (priceUsd < PEACETIME_PROMPT_USD - 0.01) {
    return null;
  }
  if (priceUsd <= PEACETIME_PROMPT_USD) {
    return EQUILIBRIUM_BREACH_HORIZON_DAYS;
  }
  if (priceUsd >= 150) {
    return 0;
  }

  let low = 0;
  let high = IMPLIED_DAYS_BISECTION_UPPER_BOUND;

  for (let iter = 0; iter < IMPLIED_DAYS_BISECTION_ITERATIONS; iter++) {
    const mid = (low + high) / 2;
    const midPrice = computePromptPrice(mid);

    // Price is monotonically DECREASING in daysToBreach — shorter breach
    // horizon means a more expensive prompt. So if the midpoint is too
    // expensive, we need to move `low` UP (longer days); if it's too
    // cheap, move `high` DOWN (fewer days).
    if (midPrice > priceUsd) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return round2((low + high) / 2);
}

function buildAlphaNarrative(args: {
  classification: FuturesCurveAlphaClassification;
  deltaM1Usd: number;
  modelDaysToBreach: number | null;
  impliedDaysToBreach: number | null;
}): string {
  const { classification, deltaM1Usd, modelDaysToBreach, impliedDaysToBreach } = args;
  const modelDaysText =
    modelDaysToBreach === null ? "no breach" : `${modelDaysToBreach.toFixed(0)}d`;
  const impliedDaysText =
    impliedDaysToBreach === null
      ? "sub-peacetime"
      : `${impliedDaysToBreach.toFixed(0)}d`;
  const magnitude = Math.abs(deltaM1Usd).toFixed(2);

  if (classification === "ALIGNED") {
    return `Paper market and physical model are aligned at the front (Δ $${magnitude}/bbl). Market implies ${impliedDaysText} to breach vs model ${modelDaysText}.`;
  }

  if (classification === "UNDERPRICED") {
    return `Market is UNDERPRICING physical deficit by $${magnitude}/bbl at M1. Market implies ${impliedDaysText} to breach; physical model calculates ${modelDaysText}.`;
  }

  return `Market is OVERPRICING relative to physical model by $${magnitude}/bbl at M1. Market implies ${impliedDaysText} to breach; physical model calculates ${modelDaysText}.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
