import type { DatasetId, InfrastructureAsset } from "../types/Infrastructure";
import { getPrimaryMetricValue } from "./infrastructure";

/**
 * The three questions the left rail's filters answer: what is in one
 * country, what one company runs, and which assets are the biggest.
 */
export interface AssetFilters {
  /** ISO code of the one country to show, or null for all. */
  countryCode: string | null;
  /** Show only the N largest assets of each layer, or null for all. */
  largestPerLayer: number | null;
  /** Operator-index id of the one operator to show, or null for all. */
  operatorId: string | null;
}

export const NO_FILTERS: AssetFilters = { countryCode: null, largestPerLayer: null, operatorId: null };

export const LARGEST_OPTIONS: readonly number[] = [10, 25, 50];

export function hasActiveFilters(filters: AssetFilters) {
  return filters.countryCode !== null || filters.operatorId !== null || filters.largestPerLayer !== null;
}

/** A pipeline counts for every country it runs through, not only its first. */
export function isInCountry(asset: InfrastructureAsset, countryCode: string | null) {
  return (
    countryCode === null ||
    asset.country === countryCode ||
    (asset.assetKind === "pipeline" && Boolean(asset.countries?.includes(countryCode)))
  );
}

/**
 * The assets that pass the filters. Country and operator narrow the set
 * first, so "largest" means the largest of what is left: the ten biggest
 * fields in Iraq, not Iraq's share of the region's ten biggest. Size is
 * each layer's headline figure; an asset with none reported cannot be
 * ranked and is left out while that filter is on.
 */
export function applyAssetFilters<TAsset extends InfrastructureAsset>(
  assets: TAsset[],
  filters: AssetFilters,
  operatorIdByAssetId: Record<string, string>
): TAsset[] {
  if (!hasActiveFilters(filters)) {
    return assets;
  }

  const matching = assets.filter(
    (asset) =>
      isInCountry(asset, filters.countryCode) &&
      (filters.operatorId === null || operatorIdByAssetId[asset.id] === filters.operatorId)
  );

  if (filters.largestPerLayer === null) {
    return matching;
  }

  const kept = new Set<string>();
  const byLayer = new Map<DatasetId, TAsset[]>();

  matching.forEach((asset) => {
    if (getPrimaryMetricValue(asset) > 0) {
      byLayer.set(asset.datasetId, [...(byLayer.get(asset.datasetId) ?? []), asset]);
    }
  });
  byLayer.forEach((layerAssets) => {
    [...layerAssets]
      .sort((left, right) => getPrimaryMetricValue(right) - getPrimaryMetricValue(left))
      .slice(0, filters.largestPerLayer ?? undefined)
      .forEach((asset) => kept.add(asset.id));
  });

  return matching.filter((asset) => kept.has(asset.id));
}
