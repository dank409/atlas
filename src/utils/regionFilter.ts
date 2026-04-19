import type { InfrastructureAsset } from "../types/Infrastructure";
import type { RegionCode } from "../components/layout/LeftRail";

/**
 * Region → country-code subset. Each chip on the LeftRail narrows
 * visible assets to the listed ISO codes plus the always-included
 * "ME" pseudo-code used by regional chokepoints. When a chip's set
 * is empty (or the region is MENA, which is the full region) the
 * filter is a pass-through so MENA feels like "show everything".
 *
 * Kept in its own module so both App.tsx and any future per-view
 * overrides consume the same ground truth. CLAUDE.md Rule #1 — no
 * fabricated data — means we intentionally omit CASPIAN here: the
 * repo has no Caspian-coded assets, so exposing the chip would be
 * misleading. The LeftRail's chip list was trimmed to match.
 */
const REGION_COUNTRY_CODES: Record<RegionCode, ReadonlyArray<string> | "ALL"> = {
  // MENA is the pass-through default — all 14 ME country codes plus
  // the "ME" pseudo-code used by multi-country chokepoint features.
  MENA: "ALL",
  // Arabian Gulf producers + littoral states. Used by the bypass
  // model as the canonical "Hormuz-exposed" set.
  AG: ["SA", "AE", "KW", "QA", "OM", "BH", "IR", "IQ", "ME"],
  // Red Sea corridor: littoral states on both shores plus Yemen,
  // Egypt (SUMED + Suez), Saudi Arabia (Yanbu), Jordan.
  RED_SEA: ["SA", "EG", "YE", "JO", "ME"],
  // Eastern Mediterranean + upper Levant. Excludes Egypt (stays in
  // Red Sea) and Gulf states.
  LEVANT: ["SY", "LB", "JO", "TR"]
};

/**
 * Filter a list of infrastructure assets to a specific region chip.
 * MENA (the default) is a pass-through. Any other region narrows to
 * the curated country-code list above — kept as a pure function so
 * consumers can memoize on `(assets, region)` without any hidden
 * state.
 */
export function filterAssetsByRegion(
  assets: InfrastructureAsset[],
  region: RegionCode
): InfrastructureAsset[] {
  const allowed = REGION_COUNTRY_CODES[region];
  if (allowed === "ALL") {
    return assets;
  }
  const allowedSet = new Set(allowed);
  return assets.filter((asset) => allowedSet.has(asset.country));
}

/**
 * Human label for each region — surfaced in the activity log so the
 * LeftRail's chip click can write a readable trace entry rather than
 * a raw enum value.
 */
export function formatRegionLabel(region: RegionCode): string {
  if (region === "RED_SEA") return "RED SEA";
  return region;
}
