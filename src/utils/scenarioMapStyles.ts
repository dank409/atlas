/**
 * Scenario Map Visual Style Helpers
 * =================================
 *
 * Pure helpers that translate bypass-model scenario state into the numeric
 * inputs Mapbox paint properties consume. All of the "how red should the
 * Hormuz overlay be at 40% disruption?" math lives here so MapView just
 * reads values and slams them into setPaintProperty calls.
 *
 * Kept as a standalone pure module (no React, no Mapbox import) so the
 * behaviour is unit-testable without stubbing a full map instance.
 */

// ---------------------------------------------------------------------------
// Asset identifiers (curated constants — single source of truth)
// ---------------------------------------------------------------------------

/** Strait of Hormuz line in `public/data/reference/chokepoints.geojson`. */
export const HORMUZ_CHOKEPOINT_ID = "chokepoint-hormuz";

/**
 * Saudi Arabia's Petroline (East-West Crude Oil Pipeline). Nameplate ~5 mbpd
 * but real globally-mitigating spare is ~2.9 mbpd (see bypassModel.ts).
 * ID sourced from `public/data/infrastructure/pipelines.geojson`.
 */
export const SAUDI_EAST_WEST_PIPELINE_ID = "pipeline-p0551";

/**
 * UAE's ADCOP (Bab-Habshan–Fujairah Oil Pipeline). Nameplate 1.5 mbpd;
 * real spare is ~0.7 mbpd because baseline east-of-Hormuz routing
 * already consumes most of it.
 */
export const UAE_ADCOP_PIPELINE_ID = "pipeline-p0553";

/**
 * Disruption % threshold above which the feedstock-risk highlight layer
 * activates. 50% is the level at which the bypass modeler starts
 * producing an unresolvable deficit in any realistic allocation — under
 * that, Petroline + ADCOP can absorb the flow and refineries keep their
 * feedstock mix.
 */
export const FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT = 50;

/**
 * Minimum curated Hormuz dependency score (on [0, 1]) for a refinery to
 * appear in the feedstock-risk layer. The score comes from
 * `public/data/reference/refinery_feedstock.json`, hydrated in
 * `workspaceData.ts` onto each refinery asset. 0.5 is the "meaningful
 * commercial or physical exposure" cut — lower values represent
 * refineries that either sit on the bypass itself (Yanbu / Rabigh via
 * Petroline, Ruwais via ADCOP) or are out-of-region consumers.
 */
export const FEEDSTOCK_RISK_DEPENDENCY_THRESHOLD = 0.5;

/**
 * Hard capacity floor (bpd) applied alongside the dependency threshold.
 * A fully Hormuz-dependent 10kbpd topping unit is not visually useful on
 * a regional risk map — the floor keeps the layer anchored to assets
 * that actually move balances. 50k bpd is ~half the old capacity
 * threshold; the dependency score is now doing the heavy lifting.
 */
export const FEEDSTOCK_RISK_MIN_CAPACITY_FLOOR_BPD = 50_000;

// ---------------------------------------------------------------------------
// Scenario visual state shape
// ---------------------------------------------------------------------------

export interface ScenarioVisualState {
  /** Hormuz disruption slider in [0, 100]. Drives the hazard overlay intensity. */
  disruptionPct: number;
  /**
   * Fraction of Saudi Petroline spare capacity currently in use, in [0, 1].
   * Comes straight from `BypassModelResult.saudiUtilisationPct` — we use the
   * *resolved* value from the model, not the raw slider, so the glow reflects
   * the actual physical bypass flow after merit-order allocation.
   */
  saudiUtilisationPct: number;
  /** Same idea for UAE ADCOP. */
  uaeUtilisationPct: number;
  /** True whenever `disruptionPct > 0`. Cached to avoid recomputing downstream. */
  isScenarioActive: boolean;
}

export const IDLE_SCENARIO_VISUAL_STATE: ScenarioVisualState = {
  disruptionPct: 0,
  saudiUtilisationPct: 0,
  uaeUtilisationPct: 0,
  isScenarioActive: false
};

// ---------------------------------------------------------------------------
// Hormuz hazard overlay
// ---------------------------------------------------------------------------

/** Faint amber at 0 → solid red at 100. Idle returns 0 (fully hidden). */
export function computeHormuzHazardOpacity(disruptionPct: number): number {
  if (disruptionPct <= 0) {
    return 0;
  }
  const t = clamp01(disruptionPct / 100);
  // 0.18 baseline so even a 1% disruption reads as "something is happening"
  // rather than a ghost line. 0.78 ceiling keeps the underlying chokepoint
  // geometry and label legible instead of blotting them out.
  return round3(0.18 + t * 0.6);
}

/** Linear RGB interpolation between #FF8C00 (amber) and #FF1744 (red). */
export function computeHormuzHazardColor(disruptionPct: number): string {
  const t = clamp01(disruptionPct / 100);
  const from = { r: 0xff, g: 0x8c, b: 0x00 }; // #FF8C00
  const to = { r: 0xff, g: 0x17, b: 0x44 }; // #FF1744
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Width in pixels. 18 at onset → 42 at full disruption. Thick enough to
 * visually "block" the strait rather than tracing it.
 */
export function computeHormuzHazardWidth(disruptionPct: number): number {
  if (disruptionPct <= 0) {
    return 0;
  }
  const t = clamp01(disruptionPct / 100);
  return round3(18 + t * 24);
}

// ---------------------------------------------------------------------------
// Bypass pipeline utilisation glow
// ---------------------------------------------------------------------------

/**
 * Glow opacity scales with pipeline utilisation [0, 1]. An unused bypass
 * stays invisible so the layer doesn't pollute the map in peacetime.
 */
export function computeBypassGlowOpacity(utilisationPct: number): number {
  if (utilisationPct <= 0) {
    return 0;
  }
  const t = clamp01(utilisationPct);
  // Baseline 0.4 so a 10% utilisation still reads as "this pipe is live"
  // rather than a ghost. 0.9 ceiling because fully saturated is saturated.
  return round3(0.4 + t * 0.5);
}

/**
 * Glow width bonus (pixels) added on top of the base pipeline width. Starts
 * at 2px (just a halo) and rises to 8px at full saturation.
 */
export function computeBypassGlowWidthBonus(utilisationPct: number): number {
  if (utilisationPct <= 0) {
    return 0;
  }
  const t = clamp01(utilisationPct);
  return round3(2 + t * 6);
}

/**
 * Color shifts from the base crude amber (#FF8C00) toward a brighter,
 * glowing yellow (#FFD600) as utilisation climbs. Saturated = "screaming".
 */
export function computeBypassGlowColor(utilisationPct: number): string {
  const t = clamp01(utilisationPct);
  const from = { r: 0xff, g: 0x8c, b: 0x00 }; // #FF8C00
  const to = { r: 0xff, g: 0xd6, b: 0x00 }; // #FFD600
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------------------------------------------------------------------------
// Refinery feedstock-risk warning ("coker starvation")
// ---------------------------------------------------------------------------

/**
 * True iff the disruption has crossed the threshold where complex refineries
 * should be flagged as feedstock-starved even if they're nominally operating.
 */
export function isFeedstockRiskActive(disruptionPct: number): boolean {
  return disruptionPct > FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT;
}

/**
 * Risk outline opacity. Idle (below threshold) = 0. Above threshold,
 * scales from 0.45 (at threshold+1) to 0.95 (at 100). Keeps a visible floor
 * so a refinery that just crossed the line still reads as warning-state.
 */
export function computeFeedstockRiskOpacity(disruptionPct: number): number {
  if (!isFeedstockRiskActive(disruptionPct)) {
    return 0;
  }
  const above = disruptionPct - FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT;
  const span = 100 - FEEDSTOCK_RISK_DISRUPTION_THRESHOLD_PCT;
  const t = clamp01(above / span);
  return round3(0.45 + t * 0.5);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
