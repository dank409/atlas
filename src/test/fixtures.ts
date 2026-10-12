import type {
  DatasetCatalogEntry,
  DatasetId,
  FieldAsset,
  PipelineAsset,
  RefineryAsset,
  TerminalAsset
} from "../types/Infrastructure";

// Asset builders for tests. Each returns a complete, valid asset; pass
// overrides for the fields a test cares about.

const METADATA = { downloadDate: "2025-03-28", source: "Test source" };

export function makeRefinery(overrides: Partial<RefineryAsset> = {}): RefineryAsset {
  return {
    _metadata: METADATA,
    assetKind: "refinery",
    capacity_bpd: 837000,
    country: "AE",
    countryName: "United Arab Emirates",
    datasetId: "refineries",
    id: "refinery-ruwais",
    lat: 24.11,
    lon: 52.73,
    name: "Ruwais Refinery",
    operator: "ADNOC Refining",
    ...overrides
  };
}

export function makePipeline(overrides: Partial<PipelineAsset> = {}): PipelineAsset {
  return {
    _metadata: METADATA,
    assetKind: "pipeline",
    capacity_boed: 5000000,
    country: "SA",
    countryName: "Saudi Arabia",
    datasetId: "pipelines",
    geometry: {
      coordinates: [
        [49.6, 25.9],
        [44.0, 24.5],
        [38.1, 24.1]
      ],
      type: "LineString"
    },
    hydrocarbon: "crude_oil",
    id: "pipeline-east-west",
    length_km: 1200,
    name: "East-West Crude Oil Pipeline",
    owner: "Saudi Aramco",
    status: "operating",
    ...overrides
  };
}

export function makeField(overrides: Partial<FieldAsset> = {}): FieldAsset {
  return {
    _metadata: METADATA,
    assetKind: "field",
    country: "SA",
    countryName: "Saudi Arabia",
    datasetId: "fields",
    fieldType: "oil",
    id: "field-ghawar",
    lat: 25.4,
    lon: 49.6,
    name: "Ghawar Oil Field",
    operator: "Saudi Aramco",
    production_bpd: 1700000,
    status: "operating",
    ...overrides
  };
}

export function makeTerminal(overrides: Partial<TerminalAsset> = {}): TerminalAsset {
  return {
    _metadata: METADATA,
    assetKind: "terminal",
    capacity_mtpa: 64,
    country: "QA",
    countryName: "Qatar",
    datasetId: "terminals",
    id: "terminal-ras-laffan",
    lat: 25.9,
    lon: 51.5,
    name: "Ras Laffan LNG Terminal",
    operator: "QatarEnergy LNG",
    owner: "QatarEnergy",
    status: "operating",
    terminalRole: "export",
    ...overrides
  };
}

const TITLES: Record<DatasetId, string> = {
  fields: "OIL & GAS FIELDS",
  pipelines: "OIL & GAS PIPELINES",
  refineries: "REFINERIES",
  terminals: "LNG TERMINALS"
};

export function makeCatalogEntry(id: DatasetId, overrides: Partial<DatasetCatalogEntry> = {}): DatasetCatalogEntry {
  return {
    downloadDate: "2025-03-28",
    id,
    license: "CC BY 4.0",
    recordCount: 1,
    source: "Test source",
    sourceUrl: "https://example.org/data",
    title: TITLES[id],
    ...overrides
  };
}

export function makeCatalog(): DatasetCatalogEntry[] {
  return (["refineries", "pipelines", "fields", "terminals"] as const).map((id) => makeCatalogEntry(id));
}
