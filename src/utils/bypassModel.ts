/**
 * Hormuz Bypass Scenario Modeler
 * ==============================
 *
 * Pure-TypeScript deterministic model for the "what happens if X% of Hormuz
 * crude throughput is disrupted" question. Drives the terminal's cross-panel
 * scenario visuals (see CLAUDE.md § Vertical Slice Mandate).
 *
 * All math lives here. UI components consume `runBypassScenario()` output and
 * never recompute independently. This is the single source of truth for the
 * bypass modeler.
 *
 * ----------------------------------------------------------------------------
 * Commercial baseline constants (stress-tested 2026-04-15)
 * ----------------------------------------------------------------------------
 *
 * - HORMUZ_CRUDE_FLOW_MBPD (14.7): restricted to CRUDE + CONDENSATE only.
 *   The commonly cited ~20 mbpd figure incorrectly includes LNG and refined
 *   products, which are not fungible with crude in refinery feedstock
 *   accounting.
 *
 * - SAUDI_SPARE_CAPACITY_MBPD (2.9): Petroline (East-West) has 7.0 mbpd
 *   nameplate capacity, but Yanbu port loading bottlenecks and domestic
 *   baseload use cap the true globally-mitigating spare at 2.9 mbpd.
 *
 * - UAE_SPARE_CAPACITY_MBPD (0.7): ADCOP nameplate is 1.5 mbpd, but
 *   pre-crisis baseline utilisation (routine east-of-Hormuz routing)
 *   already consumes most of it. Real spare is 0.7 mbpd.
 *
 * - IEA_MAX_RATE_MBPD (4.0): governed by hydraulic cavern extraction
 *   limits across member-country strategic reserves. The coordinated
 *   release cannot sustain more than ~4.0 mbpd physically regardless
 *   of political will.
 *
 * - IEA_CUMULATIVE_CAP_MB (400): governance hard cap on the total
 *   coordinated release in a single event.
 *
 * - STARTING_INVENTORY_MB (968) / OPERATIONAL_MINIMUM_MB (842):
 *   OECD commercial crude stocks and the minimum operationally-viable
 *   floor (below which refinery runs begin to curtail).
 */

// ---------------------------------------------------------------------------
// Baseline constants
// ---------------------------------------------------------------------------

export const HORMUZ_CRUDE_FLOW_MBPD = 14.7;
export const SAUDI_SPARE_CAPACITY_MBPD = 2.9;
export const UAE_SPARE_CAPACITY_MBPD = 0.7;
export const IEA_MAX_RATE_MBPD = 4.0;
export const IEA_CUMULATIVE_CAP_MB = 400;
export const STARTING_INVENTORY_MB = 968;
export const OPERATIONAL_MINIMUM_MB = 842;

export interface BypassConstants {
  hormuzCrudeFlowMbpd: number;
  saudiSpareCapacityMbpd: number;
  uaeSpareCapacityMbpd: number;
  ieaMaxRateMbpd: number;
  ieaCumulativeCapMb: number;
  startingInventoryMb: number;
  operationalMinimumMb: number;
}

export const DEFAULT_BYPASS_CONSTANTS: BypassConstants = {
  hormuzCrudeFlowMbpd: HORMUZ_CRUDE_FLOW_MBPD,
  saudiSpareCapacityMbpd: SAUDI_SPARE_CAPACITY_MBPD,
  uaeSpareCapacityMbpd: UAE_SPARE_CAPACITY_MBPD,
  ieaMaxRateMbpd: IEA_MAX_RATE_MBPD,
  ieaCumulativeCapMb: IEA_CUMULATIVE_CAP_MB,
  startingInventoryMb: STARTING_INVENTORY_MB,
  operationalMinimumMb: OPERATIONAL_MINIMUM_MB
};

// ---------------------------------------------------------------------------
// Inputs, outputs, and states
// ---------------------------------------------------------------------------

export interface BypassModelInputs {
  /**
   * Percentage of Hormuz crude flow disrupted, in [0, 100] under normal use.
   *
   * Negative values are permitted as a safeguard path for the REPLENISHING
   * state — they represent a hypothetical supply glut (non-physical, but
   * exercised by tests to prove the function never returns negative days).
   */
  disruptionPct: number;

  /** Optional constant overrides for scenario sensitivity testing. */
  overrides?: Partial<BypassConstants>;
}

export type BypassModelState = "EQUILIBRIUM" | "REPLENISHING" | "DEPLETING";

export interface BypassModelResult {
  /** Strict sign-based classification of the net daily deficit. */
  state: BypassModelState;

  /** Echo of the driving input. */
  disruptionPct: number;

  /** Resolved constants actually used (defaults merged with any overrides). */
  constants: BypassConstants;

  // ---- Flow accounting (mbpd, rounded to 0.01 precision) ----
  grossDisruptedMbpd: number;
  saudiBypassUtilisedMbpd: number;
  uaeBypassUtilisedMbpd: number;
  totalBypassUtilisedMbpd: number;
  postBypassDeficitMbpd: number;
  ieaDailyReleaseMbpd: number;
  netDailyDeficitMbpd: number;

  // ---- Bypass pipeline utilisation as a fraction of spare [0, 1] ----
  saudiUtilisationPct: number;
  uaeUtilisationPct: number;

  // ---- Forward-looking time estimates ----
  /**
   * Days until the IEA coordinated release hits its 400 mb cumulative cap,
   * assuming sustained release at the current `ieaDailyReleaseMbpd`. Null
   * when IEA is not actively releasing (no post-bypass deficit).
   *
   * Exposed in every state — even EQUILIBRIUM — because a state that is
   * currently flat thanks to IEA absorption is still finite and the UI
   * needs to warn when that runway expires.
   */
  ieaExhaustionDays: number | null;

  /**
   * Days until OECD commercial inventory hits the operational minimum,
   * computed via a two-phase simulation (IEA active → IEA exhausted).
   *
   * Null when state !== "DEPLETING" — the explicit anti-division-by-zero
   * and anti-negative-days guarantee. UI layers can rely on `null` meaning
   * "not applicable" rather than having to guard against ∞ or negatives.
   */
  daysToOperationalMinimum: number | null;

  /** Inventory level at the moment of breach (always OPERATIONAL_MINIMUM
   *  when populated, null otherwise). Exposed explicitly so callers don't
   *  have to look up the constant. */
  breachInventoryMb: number | null;

  /** Human-readable summary. Useful for tooltips and the scenario rationale
   *  panel. Structure is not stable; treat as display text only. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the bypass scenario for a given disruption level.
 *
 * Deterministic and pure: no I/O, no React, no clock, no randomness. Every
 * output is a function of `inputs` alone. Safe to call inside `useMemo`.
 */
export function runBypassScenario(inputs: BypassModelInputs): BypassModelResult {
  const constants: BypassConstants = {
    ...DEFAULT_BYPASS_CONSTANTS,
    ...inputs.overrides
  };

  const { disruptionPct } = inputs;

  // Step 1: gross disrupted flow. Can be negative when disruptionPct < 0
  // (glut scenario) — that path exists purely to prove the REPLENISHING
  // safeguard branch and is non-physical.
  const grossDisruptedMbpd = round2(
    constants.hormuzCrudeFlowMbpd * (disruptionPct / 100)
  );

  // Step 2: bypass allocation — merit order, Saudi first (higher capacity),
  // UAE second. Both clamped to non-negative so that a negative gross does
  // not "draw extra crude" out of pipelines that physically can't reverse.
  const saudiBypassUtilisedMbpd = round2(
    Math.max(0, Math.min(grossDisruptedMbpd, constants.saudiSpareCapacityMbpd))
  );
  const remainingAfterSaudi = Math.max(
    0,
    grossDisruptedMbpd - constants.saudiSpareCapacityMbpd
  );
  const uaeBypassUtilisedMbpd = round2(
    Math.max(0, Math.min(remainingAfterSaudi, constants.uaeSpareCapacityMbpd))
  );
  const totalBypassUtilisedMbpd = round2(
    saudiBypassUtilisedMbpd + uaeBypassUtilisedMbpd
  );

  const saudiUtilisationPct =
    constants.saudiSpareCapacityMbpd > 0
      ? round2(saudiBypassUtilisedMbpd / constants.saudiSpareCapacityMbpd)
      : 0;
  const uaeUtilisationPct =
    constants.uaeSpareCapacityMbpd > 0
      ? round2(uaeBypassUtilisedMbpd / constants.uaeSpareCapacityMbpd)
      : 0;

  // Step 3: post-bypass deficit. Negative when gross is negative.
  const postBypassDeficitMbpd = round2(
    grossDisruptedMbpd - totalBypassUtilisedMbpd
  );

  // Step 4: IEA daily release, clamped to [0, ieaMaxRate]. The Math.max(0,...)
  // is part of the REPLENISHING safeguard — a negative postBypass must never
  // produce a "negative IEA release."
  const ieaDailyReleaseMbpd = round2(
    Math.max(0, Math.min(postBypassDeficitMbpd, constants.ieaMaxRateMbpd))
  );

  // Step 5: net daily deficit after IEA absorption. The sign of this number
  // drives the state branch.
  const netDailyDeficitMbpd = round2(
    postBypassDeficitMbpd - ieaDailyReleaseMbpd
  );

  // Step 6: state determination based strictly on net daily deficit sign.
  // Division-by-zero and negative-days safeguards live in this branch.
  const state: BypassModelState =
    netDailyDeficitMbpd > 0
      ? "DEPLETING"
      : netDailyDeficitMbpd < 0
        ? "REPLENISHING"
        : "EQUILIBRIUM";

  // Step 7: IEA exhaustion runway. Computed even when state is EQUILIBRIUM
  // so the UI can warn "flat for now, IEA runs out in N days."
  const ieaExhaustionDays =
    ieaDailyReleaseMbpd > 0
      ? round2(constants.ieaCumulativeCapMb / ieaDailyReleaseMbpd)
      : null;

  // Step 8: days-to-operational-minimum via two-phase simulation. Only
  // populated for DEPLETING states — the explicit safeguard.
  const daysToOperationalMinimum = computeDaysToOperationalMinimum({
    state,
    postBypassDeficitMbpd,
    constants
  });

  const breachInventoryMb =
    daysToOperationalMinimum !== null ? constants.operationalMinimumMb : null;

  return {
    state,
    disruptionPct,
    constants,
    grossDisruptedMbpd,
    saudiBypassUtilisedMbpd,
    uaeBypassUtilisedMbpd,
    totalBypassUtilisedMbpd,
    postBypassDeficitMbpd,
    ieaDailyReleaseMbpd,
    netDailyDeficitMbpd,
    saudiUtilisationPct,
    uaeUtilisationPct,
    ieaExhaustionDays,
    daysToOperationalMinimum,
    breachInventoryMb,
    rationale: buildRationale({
      state,
      disruptionPct,
      totalBypassUtilisedMbpd,
      ieaDailyReleaseMbpd,
      netDailyDeficitMbpd,
      daysToOperationalMinimum,
      ieaExhaustionDays
    })
  };
}

// ---------------------------------------------------------------------------
// Days-to-operational-minimum: two-phase simulation
// ---------------------------------------------------------------------------

interface ComputeDaysArgs {
  state: BypassModelState;
  postBypassDeficitMbpd: number;
  constants: BypassConstants;
}

/**
 * Computes the real-world days-to-breach for DEPLETING states only.
 *
 * In EQUILIBRIUM (even when sustained by active IEA release draining the
 * 400 mb cap), this returns null. The trader's horizon in that case is
 * exposed separately as `ieaExhaustionDays` on the BypassModelResult, and
 * the UI surfaces whichever number is relevant for the state.
 *
 * The two-phase simulation runs only when postBypass > iea rate:
 *   Phase 1 — IEA active at full rate, inventory draws at (postBypass - iea).
 *             Ends when the IEA cap is hit.
 *   Phase 2 — IEA exhausted, inventory draws at full postBypass rate.
 */
function computeDaysToOperationalMinimum(args: ComputeDaysArgs): number | null {
  const { state, postBypassDeficitMbpd, constants } = args;

  if (state !== "DEPLETING") {
    return null;
  }

  const availableBufferMb =
    constants.startingInventoryMb - constants.operationalMinimumMb;

  // Already at or below operational minimum — immediate breach.
  if (availableBufferMb <= 0) {
    return 0;
  }

  // Guard against an impossible DEPLETING state with zero deficit. Should
  // not happen given Step 6's sign check, but belt-and-suspenders.
  if (postBypassDeficitMbpd <= 0) {
    return null;
  }

  const ieaActiveRateMbpd = Math.min(
    postBypassDeficitMbpd,
    constants.ieaMaxRateMbpd
  );
  const phase1DrawRateMbpd = postBypassDeficitMbpd - ieaActiveRateMbpd;

  // Case A: no IEA engagement (edge case where ieaMaxRate is 0 via override).
  // Full post-bypass deficit draws immediately on inventory.
  if (ieaActiveRateMbpd <= 0) {
    return round2(availableBufferMb / postBypassDeficitMbpd);
  }

  const ieaExhaustionDaysRaw = constants.ieaCumulativeCapMb / ieaActiveRateMbpd;

  // Standard two-phase path: phase 1 inventory draw is capped by IEA
  // exhaustion, then phase 2 takes over at full post-bypass rate. By this
  // point phase1DrawRate is guaranteed positive — if IEA absorbed the entire
  // deficit the state would be EQUILIBRIUM, which the early return caught.
  const phase1MaxDrawMb = phase1DrawRateMbpd * ieaExhaustionDaysRaw;

  if (phase1MaxDrawMb >= availableBufferMb) {
    // Breach occurs during phase 1, before IEA cap is hit.
    return round2(availableBufferMb / phase1DrawRateMbpd);
  }

  // Breach occurs during phase 2, after IEA has been fully drained.
  const remainingBufferAtPhase2Mb = availableBufferMb - phase1MaxDrawMb;
  const phase2DaysToBreach = remainingBufferAtPhase2Mb / postBypassDeficitMbpd;
  return round2(ieaExhaustionDaysRaw + phase2DaysToBreach);
}

// ---------------------------------------------------------------------------
// Rationale string (display-only)
// ---------------------------------------------------------------------------

interface RationaleArgs {
  state: BypassModelState;
  disruptionPct: number;
  totalBypassUtilisedMbpd: number;
  ieaDailyReleaseMbpd: number;
  netDailyDeficitMbpd: number;
  daysToOperationalMinimum: number | null;
  ieaExhaustionDays: number | null;
}

function buildRationale(args: RationaleArgs): string {
  const pctLabel = `${args.disruptionPct.toFixed(0)}% HORMUZ CRUDE DISRUPTION`;

  if (args.state === "EQUILIBRIUM") {
    if (args.ieaDailyReleaseMbpd > 0 && args.ieaExhaustionDays !== null) {
      return `${pctLabel}: BYPASS + IEA RELEASE (${args.ieaDailyReleaseMbpd.toFixed(2)} MBPD) FULLY ABSORB SHORTFALL. IEA CAP HIT IN ${args.ieaExhaustionDays.toFixed(1)} DAYS.`;
    }
    if (args.totalBypassUtilisedMbpd > 0) {
      return `${pctLabel}: BYPASS PIPELINES FULLY ABSORB SHORTFALL (${args.totalBypassUtilisedMbpd.toFixed(2)} MBPD). INVENTORY FLAT.`;
    }
    return `${pctLabel}: NO NET DEFICIT. INVENTORY FLAT.`;
  }

  if (args.state === "REPLENISHING") {
    return `${pctLabel}: INPUTS PRODUCE NET SUPPLY SURPLUS (${Math.abs(args.netDailyDeficitMbpd).toFixed(2)} MBPD). INVENTORY REBUILDING — NEGATIVE DAYS-TO-BREACH SUPPRESSED.`;
  }

  // DEPLETING
  const daysLabel =
    args.daysToOperationalMinimum !== null
      ? `${args.daysToOperationalMinimum.toFixed(1)} DAYS`
      : "--";
  const ieaLabel =
    args.ieaExhaustionDays !== null
      ? ` | IEA CAP HIT AT DAY ${args.ieaExhaustionDays.toFixed(1)}`
      : "";
  return `${pctLabel}: NET DEFICIT ${args.netDailyDeficitMbpd.toFixed(2)} MBPD AFTER BYPASS + IEA. OECD MINIMUM BREACHED IN ${daysLabel}${ieaLabel}.`;
}

// ---------------------------------------------------------------------------
// Dynamic IEA cumulative cap tracker
// ---------------------------------------------------------------------------

export interface IeaDrawdownArgs {
  /** Requested IEA daily release rate, mbpd. Negative values are clamped to 0. */
  dailyReleaseRateMbpd: number;
  /** Simulation horizon, days. */
  horizonDays: number;
  /** Optional override for the cumulative governance cap (default 400 mb). */
  cumulativeCapMb?: number;
  /** Optional override for the hydraulic max daily rate (default 4.0 mbpd). */
  maxDailyRateMbpd?: number;
}

export interface IeaDrawdownResult {
  cumulativeReleaseMb: number;
  capReached: boolean;
  daysToCapReached: number | null;
  effectiveDailyReleaseMbpd: number;
}

/**
 * Companion simulator to `runBypassScenario`. Answers:
 *
 *   "If the IEA sustains a release of X mbpd for N days, what's the
 *    cumulative drawdown, and does it blow through the 400 mb cap?"
 *
 * Enforces:
 *
 *   1. The hydraulic ceiling (daily rate clamped to `maxDailyRateMbpd`).
 *   2. The governance cumulative cap (total clamped to `cumulativeCapMb`).
 *   3. Non-negative rates (negative inputs clamp to zero, preventing a
 *      "negative cumulative release" which would be nonsense).
 */
export function simulateIeaDrawdown(args: IeaDrawdownArgs): IeaDrawdownResult {
  const cap = args.cumulativeCapMb ?? IEA_CUMULATIVE_CAP_MB;
  const maxRate = args.maxDailyRateMbpd ?? IEA_MAX_RATE_MBPD;
  const effectiveRate = Math.max(
    0,
    Math.min(args.dailyReleaseRateMbpd, maxRate)
  );

  if (effectiveRate === 0) {
    return {
      cumulativeReleaseMb: 0,
      capReached: false,
      daysToCapReached: null,
      effectiveDailyReleaseMbpd: 0
    };
  }

  const uncappedCumulative = effectiveRate * args.horizonDays;
  const daysToCapReached = cap / effectiveRate;

  if (uncappedCumulative >= cap) {
    return {
      cumulativeReleaseMb: round2(cap),
      capReached: true,
      daysToCapReached: round2(daysToCapReached),
      effectiveDailyReleaseMbpd: round2(effectiveRate)
    };
  }

  return {
    cumulativeReleaseMb: round2(uncappedCumulative),
    capReached: false,
    daysToCapReached: round2(daysToCapReached),
    effectiveDailyReleaseMbpd: round2(effectiveRate)
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Round to 0.01 precision. Counters IEEE 754 float artifacts in the
 * subtract-then-compare sequences that pervade the model (e.g.
 * `14.7 * 0.7 - 3.6 = 6.689999...` instead of `6.69`).
 *
 * The whole model commits to 0.01 mbpd precision as its contract so the UI
 * never has to worry about display rounding drift.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
