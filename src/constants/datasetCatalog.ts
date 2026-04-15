import type { DatasetCatalogEntry } from "../types/Infrastructure";

export const DATASET_CATALOG_SEED: Array<Omit<DatasetCatalogEntry, "recordCount">> = [
  {
    coverage: "Middle East",
    defaultActive: true,
    frequency: "Quarterly",
    id: "refineries",
    notes: "OGIM refinery sites with operator and capacity coverage, plus a tiny curated supplement where named Gulf sites are missing from the open source layer.",
    source: "EDF OGIM + curated supplement",
    status: "available",
    title: "REFINERIES"
  },
  {
    coverage: "Middle East",
    defaultActive: true,
    frequency: "Quarterly",
    id: "pipelines",
    notes: "GOIT and GGIT route geometries filtered to the regional hydrocarbon network.",
    source: "Global Energy Monitor",
    status: "available",
    title: "CRUDE / GAS PIPELINES"
  },
  {
    coverage: "Middle East",
    defaultActive: false,
    frequency: "Quarterly",
    id: "fields",
    notes: "GOGET field centroids with operator, status, basin, and production context where source units support it.",
    source: "Global Energy Monitor",
    status: "available",
    title: "OIL & GAS FIELDS"
  },
  {
    coverage: "Middle East",
    defaultActive: false,
    frequency: "Quarterly",
    id: "terminals",
    notes: "GGIT LNG import and export terminals aggregated to site-level map assets.",
    source: "Global Energy Monitor",
    status: "available",
    title: "TERMINALS / LNG"
  },
  {
    coverage: "Middle East",
    defaultActive: true,
    frequency: "Periodic",
    id: "chokepoints",
    notes: "Static strategic transit references anchored in EIA chokepoint analysis.",
    source: "EIA + curated reference",
    status: "available",
    title: "CHOKEPOINTS"
  }
];
