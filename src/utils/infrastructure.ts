import type { DatasetId, InfrastructureAsset } from "../types/Infrastructure";
import { getEnergyType, type EnergyType } from "./assetEnergy";
import { formatDailyVolume, formatMtpa } from "./formatters";

/** Assets whose layer and energy type are both switched on. */
export function filterAssets(
  assets: InfrastructureAsset[],
  activeDatasetIds: DatasetId[],
  activeEnergyTypes: EnergyType[]
) {
  return assets.filter(
    (asset) => activeDatasetIds.includes(asset.datasetId) && activeEnergyTypes.includes(getEnergyType(asset))
  );
}

/** Case-insensitive match against name, country, operator / owner and type. */
export function matchesQuery(asset: InfrastructureAsset, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return normalizedQuery === "" || buildSearchText(asset).includes(normalizedQuery);
}

export function buildSearchResults(assets: InfrastructureAsset[], query: string) {
  return query.trim() === "" ? [] : assets.filter((asset) => matchesQuery(asset, query));
}

export function countByDataset(assets: InfrastructureAsset[]): Record<DatasetId, number> {
  const counts: Record<DatasetId, number> = { fields: 0, pipelines: 0, refineries: 0, terminals: 0 };

  assets.forEach((asset) => {
    counts[asset.datasetId] += 1;
  });

  return counts;
}

/** Largest headline number first; assets with no reported number last, by name. */
export function sortByPrimaryMetric<TAsset extends InfrastructureAsset>(assets: TAsset[]): TAsset[] {
  return [...assets].sort(
    (left, right) => getPrimaryMetricValue(right) - getPrimaryMetricValue(left) || left.name.localeCompare(right.name)
  );
}

export function countByEnergyType(assets: InfrastructureAsset[]): Record<EnergyType, number> {
  const counts: Record<EnergyType, number> = { gas: 0, mixed: 0, ngl: 0, oil: 0 };

  assets.forEach((asset) => {
    counts[getEnergyType(asset)] += 1;
  });

  return counts;
}

export function getAssetTypeLabel(asset: InfrastructureAsset) {
  if (asset.assetKind === "pipeline") {
    return "PIPELINE";
  }

  if (asset.assetKind === "refinery") {
    return "REFINERY";
  }

  if (asset.assetKind === "field") {
    return "FIELD";
  }

  return "LNG TERMINAL";
}

/**
 * Name for lists and tooltips. GEM splits many pipelines into segments
 * that share one name, so the segment is appended to tell them apart.
 */
export function getAssetDisplayName(asset: InfrastructureAsset) {
  return asset.assetKind === "pipeline" && asset.segmentName ? `${asset.name} · ${asset.segmentName}` : asset.name;
}

/** The company the source names for the asset: operator where given, else owner. */
export function getAssetOperator(asset: InfrastructureAsset): string | null {
  if (asset.assetKind === "pipeline") {
    return asset.owner || null;
  }

  if (asset.assetKind === "terminal") {
    return asset.operator || asset.owner || null;
  }

  return asset.operator || null;
}

/**
 * Project status as the source publishes it. Null for refineries, which
 * have none. Shown as a labelled source field, never as our own claim.
 */
export function getSourceStatus(asset: InfrastructureAsset): string | null {
  return asset.assetKind === "refinery" ? null : asset.status;
}

/** False only when the source explicitly gives a status other than operating. */
export function isOperating(asset: InfrastructureAsset) {
  const status = getSourceStatus(asset);

  return status === null || status === "operating";
}

/** The one headline number per asset; `--` when the source does not report it. */
export function formatPrimaryMetric(asset: InfrastructureAsset) {
  if (asset.assetKind === "refinery") {
    return asset.capacity_bpd ? formatDailyVolume(asset.capacity_bpd) : "--";
  }

  if (asset.assetKind === "pipeline") {
    return asset.capacity_boed ? formatDailyVolume(asset.capacity_boed, "BOE/D") : "--";
  }

  if (asset.assetKind === "terminal") {
    return asset.capacity_mtpa ? formatMtpa(asset.capacity_mtpa) : "--";
  }

  // GEM's field figure combines oil and gas, so it is barrels of oil
  // equivalent, not barrels (the property name predates that distinction).
  return asset.production_bpd ? formatDailyVolume(asset.production_bpd, "BOE/D") : "--";
}

/** Numeric value behind `formatPrimaryMetric`, for sorting. Missing sorts as 0. */
export function getPrimaryMetricValue(asset: InfrastructureAsset) {
  if (asset.assetKind === "refinery") {
    return asset.capacity_bpd ?? 0;
  }

  if (asset.assetKind === "pipeline") {
    return asset.capacity_boed ?? 0;
  }

  if (asset.assetKind === "terminal") {
    return asset.capacity_mtpa ?? 0;
  }

  return asset.production_bpd ?? 0;
}

function buildSearchText(asset: InfrastructureAsset) {
  return [
    getAssetDisplayName(asset),
    asset.countryName,
    asset.country,
    getAssetOperator(asset),
    asset.assetKind === "terminal" ? asset.owner : "",
    getAssetTypeLabel(asset),
    asset.assetKind === "pipeline" ? asset.countries?.join(" ") : "",
    asset.assetKind === "pipeline" ? asset.hydrocarbon.replaceAll("_", " ") : "",
    asset.assetKind === "field" ? asset.fieldType : "",
    asset.assetKind === "terminal" ? asset.terminalRole : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
