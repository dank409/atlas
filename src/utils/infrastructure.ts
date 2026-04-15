import type {
  AssetGridRow,
  ChokepointAsset,
  DatasetCatalogEntry,
  DatasetFiltersById,
  DatasetId,
  InfrastructureAsset,
  PipelineAsset,
  RefineryAsset
} from "../types/Infrastructure";
import { formatCapacity, formatCapacityCompact, formatLengthKm, formatMtpa, formatTransitVolume } from "./formatters";

export const DEFAULT_DATASET_FILTERS: DatasetFiltersById = {
  chokepoints: {
    country: "ALL",
    status: "ALL",
    text: ""
  },
  fields: {
    country: "ALL",
    status: "ALL",
    text: ""
  },
  pipelines: {
    country: "ALL",
    hydrocarbon: "ALL",
    status: "ALL",
    text: ""
  },
  refineries: {
    country: "ALL",
    operator: "ALL",
    status: "ALL",
    text: ""
  },
  terminals: {
    country: "ALL",
    status: "ALL",
    text: ""
  }
};

export function filterAssets(
  assets: InfrastructureAsset[],
  activeDatasetIds: DatasetId[],
  filtersByDataset: DatasetFiltersById
) {
  return assets.filter((asset) => {
    if (!activeDatasetIds.includes(asset.datasetId)) {
      return false;
    }

    const query = filtersByDataset[asset.datasetId].text.trim().toLowerCase();

    if (query && !matchesText(asset, query)) {
      return false;
    }

    if (filtersByDataset[asset.datasetId].country !== "ALL" && asset.country !== filtersByDataset[asset.datasetId].country) {
      return false;
    }

    if (filtersByDataset[asset.datasetId].status !== "ALL" && asset.status !== filtersByDataset[asset.datasetId].status) {
      return false;
    }

    if (asset.assetKind === "refinery") {
      const refineryFilters = filtersByDataset.refineries;

      if (refineryFilters.operator !== "ALL" && asset.operator !== refineryFilters.operator) {
        return false;
      }
    }

    if (asset.assetKind === "pipeline") {
      const pipelineFilters = filtersByDataset.pipelines;

      if (pipelineFilters.hydrocarbon !== "ALL" && asset.hydrocarbon !== pipelineFilters.hydrocarbon) {
        return false;
      }
    }

    return true;
  });
}

export function buildAssetGridRows(assets: InfrastructureAsset[], catalog: DatasetCatalogEntry[]): AssetGridRow[] {
  const catalogLabelById = Object.fromEntries(catalog.map((entry) => [entry.id, entry.title]));

  return assets
    .map((asset) => ({
      asset,
      countryName: asset.countryName,
      datasetLabel: catalogLabelById[asset.datasetId] ?? asset.datasetId.toUpperCase(),
      name: asset.name,
      primaryMetric: buildPrimaryMetric(asset),
      reference: asset.linkedContext?.ticker ?? asset._metadata.source,
      secondaryMetric: buildSecondaryMetric(asset),
      status: asset.status.replaceAll("_", " ")
    }));
}

export function buildSearchResults(assets: InfrastructureAsset[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return assets.filter((asset) =>
    [asset.name, asset.countryName, asset.country, buildOwner(asset), buildOperator(asset), getAssetTypeLabel(asset)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

export function buildDatasetOptions(assets: InfrastructureAsset[], datasetId: DatasetId, field: "country" | "status" | "operator" | "hydrocarbon") {
  const datasetAssets = assets.filter((asset) => asset.datasetId === datasetId);
  const values = new Set<string>();

  datasetAssets.forEach((asset) => {
    if (field === "country") {
      values.add(asset.country);
      return;
    }

    if (field === "status") {
      values.add(asset.status);
      return;
    }

    if (field === "operator" && asset.assetKind === "refinery") {
      values.add(asset.operator);
      return;
    }

    if (field === "hydrocarbon" && asset.assetKind === "pipeline") {
      values.add(asset.hydrocarbon);
    }
  });

  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

export function getAssetTypeLabel(asset: InfrastructureAsset) {
  if (asset.assetKind === "pipeline") {
    return "PIPELINE";
  }

  if (asset.assetKind === "refinery") {
    return "REFINERY";
  }

  if (asset.assetKind === "chokepoint") {
    return "CHOKEPOINT";
  }

  if (asset.assetKind === "field") {
    return "FIELD";
  }

  return "TERMINAL";
}

export function getLegendItems(datasetId: DatasetId) {
  if (datasetId === "refineries") {
    return [
      { color: "#00C853", label: "Operational" },
      { color: "#FF8C00", label: "Planned startup / maintenance" },
      { color: "#FF1744", label: "Unplanned incident" },
      { color: "#2196F3", label: "Construction" },
      { color: "#666666", label: "Status unavailable" }
    ];
  }

  if (datasetId === "pipelines") {
    return [
      { color: "#FF5722", label: "Crude oil" },
      { color: "#FF8C00", label: "Natural gas" },
      { color: "#FFB74D", label: "NGL" },
      { color: "#FFFFFF", label: "Mixed / strategic" }
    ];
  }

  if (datasetId === "chokepoints") {
    return [
      { color: "#FF1744", label: "Strategic chokepoint" }
    ];
  }

  if (datasetId === "fields") {
    return [
      { color: "#FF8C00", label: "Oil-weighted" },
      { color: "#64B5F6", label: "Gas-weighted" },
      { color: "#E0E0E0", label: "Mixed / condensate" }
    ];
  }

  if (datasetId === "terminals") {
    return [
      { color: "#FF8C00", label: "Export terminal" },
      { color: "#64B5F6", label: "Import terminal" }
    ];
  }

  return [];
}

function buildOwner(asset: InfrastructureAsset) {
  if (asset.assetKind === "pipeline" || asset.assetKind === "refinery") {
    return asset.owner;
  }

  if (asset.assetKind === "terminal") {
    return asset.owner ?? "";
  }

  return "";
}

function buildOperator(asset: InfrastructureAsset) {
  if (asset.assetKind === "pipeline" || asset.assetKind === "refinery" || asset.assetKind === "terminal") {
    return asset.operator ?? "";
  }

  return "";
}

function matchesText(asset: InfrastructureAsset, query: string) {
  return [
    asset.name,
    asset.countryName,
    asset.country,
    buildOwner(asset),
    buildOperator(asset),
    getAssetTypeLabel(asset),
    asset.assetKind === "pipeline" ? asset.countries?.join(" ") : "",
    asset.assetKind === "field" ? asset.fieldType ?? "" : "",
    asset.assetKind === "terminal" ? asset.terminalRole ?? asset.terminalType ?? "" : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function buildPrimaryMetric(asset: InfrastructureAsset) {
  if (asset.assetKind === "refinery") {
    return asset.capacity_bpd ? formatCapacityCompact(asset.capacity_bpd) : "--";
  }

  if (asset.assetKind === "pipeline") {
    return asset.capacity_boed ? formatCapacity(asset.capacity_boed).replace("bpd", "BOE/D") : "--";
  }

  if (asset.assetKind === "chokepoint") {
    return formatTransitVolume(asset.transitVolume_mbpd);
  }

  if (asset.assetKind === "terminal") {
    return asset.capacity_mtpa ? formatMtpa(asset.capacity_mtpa) : "--";
  }

  if (asset.assetKind === "field") {
    return asset.production_bpd ? formatCapacityCompact(asset.production_bpd) : "--";
  }

  return "--";
}

function buildSecondaryMetric(asset: InfrastructureAsset) {
  if (asset.assetKind === "pipeline") {
    return asset.length_km ? formatLengthKm(asset.length_km) : "--";
  }

  if (asset.assetKind === "refinery") {
    return buildOwner(asset);
  }

  if (asset.assetKind === "chokepoint") {
    return asset.linkedContext?.benchmarkRefs?.join(" | ") ?? "Strategic transit";
  }

  if (asset.assetKind === "terminal") {
    return asset.terminalRole ? `${asset.terminalRole.toUpperCase()} LNG` : buildOwner(asset);
  }

  if (asset.assetKind === "field") {
    return asset.basin ?? "--";
  }

  return "--";
}

export function isRefineryAsset(asset: InfrastructureAsset): asset is RefineryAsset {
  return asset.assetKind === "refinery";
}

export function isPipelineAsset(asset: InfrastructureAsset): asset is PipelineAsset {
  return asset.assetKind === "pipeline";
}

export function isChokepointAsset(asset: InfrastructureAsset): asset is ChokepointAsset {
  return asset.assetKind === "chokepoint";
}
