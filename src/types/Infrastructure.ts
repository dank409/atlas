import type { RefineryStatus, SourceMetadata } from "./Refinery";

export type DatasetId = "refineries" | "pipelines" | "fields" | "terminals" | "chokepoints";
export type DatasetStatus = "available" | "curating";

export interface LinkedContextRef {
  benchmarkRefs?: string[];
  companyId?: string;
  countryCode?: string;
  ticker?: string;
}

export interface LineStringGeometry {
  coordinates: Array<[number, number]>;
  type: "LineString";
}

export interface MultiLineStringGeometry {
  coordinates: Array<Array<[number, number]>>;
  type: "MultiLineString";
}

export interface DatasetCatalogEntry {
  coverage: string;
  defaultActive: boolean;
  frequency: string;
  id: DatasetId;
  notes: string;
  recordCount: number;
  source: string;
  status: DatasetStatus;
  title: string;
}

export interface CompanyProfile {
  benchmarks: string[];
  domicile: string;
  id: string;
  name: string;
  source: string;
  summary: string;
  tickers: string[];
  updated: string;
  website: string;
}

export interface CountryProfile {
  /**
   * Short prose summary of how the country is exposed to chokepoints.
   * Rendered directly in the right-rail country context card — keep it
   * tight (1-2 sentences).
   */
  chokepointDependency: string;
  code: string;
  keyGrades: string[];
  name: string;
  source: string;
  summary: string;
  updated: string;
  /**
   * Optional [0, 1] export-dependency scores per chokepoint, added
   * with the P1 country-profile expansion. Current UI still reads the
   * prose `chokepointDependency` field; these are future-use data for
   * a structured dependency table.
   */
  chokepointScores?: {
    hormuz: number;
    babElMandeb: number;
    suez: number;
  };
  /** Country-level physical bypass capacity around Hormuz, mbpd. */
  bypassCapacityMbpd?: number;
  /** Total refining capacity, bpd. */
  keyRefineriesBpd?: number;
  /** Named principal export terminals. */
  keyExportTerminals?: string[];
}

export interface BaseAsset {
  _metadata: Pick<SourceMetadata, "downloadDate" | "source">;
  assetKind: "refinery" | "pipeline" | "field" | "terminal" | "chokepoint";
  country: string;
  countryName: string;
  datasetId: DatasetId;
  id: string;
  linkedContext?: LinkedContextRef;
  name: string;
  status: string;
}

export interface RefineryAsset extends BaseAsset {
  assetKind: "refinery";
  capacity_bpd?: number;
  capacityUnit: string;
  country: string;
  countryName: string;
  datasetId: "refineries";
  firmsRadius_km?: number;
  /**
   * Curated Hormuz crude dependency score in [0, 1]. Hydrated in
   * `workspaceData.ts` by joining `public/data/reference/refinery_feedstock.json`
   * against the refinery feature ID. Undefined when the curator has not
   * scored the refinery yet — `buildPointCollection` defaults undefined
   * values to 0 ("assume resilient") before passing to Mapbox.
   */
  hormuzDependency?: number;
  lat: number;
  lon: number;
  operator: string;
  owner: string;
  status: RefineryStatus;
  ticker?: string;
  type?: string;
}

export type PipelineHydrocarbon = "crude_oil" | "natural_gas" | "ngl" | "products" | "mixed";
export type PipelineStatus = "operating" | "construction" | "proposed" | "mothballed" | "decommissioned";

export type PipelineGeometryConfidence = "high" | "low";

export interface PipelineAsset extends BaseAsset {
  assetKind: "pipeline";
  capacity_boed?: number;
  country: string;
  countryName: string;
  countries?: string[];
  datasetId: "pipelines";
  diameter_inches?: number;
  endPoint?: string;
  geometry: LineStringGeometry | MultiLineStringGeometry;
  // "low" = schematic: straight 2-point line over long distance. GEM often
  // ships these when only the endpoints are known. We render them dashed
  // and dimmed so they can't be confused with surveyed routes.
  geometryConfidence: PipelineGeometryConfidence;
  hydrocarbon: PipelineHydrocarbon;
  length_km?: number;
  operator?: string;
  owner: string;
  segmentName?: string;
  startPoint?: string;
  status:
    | PipelineStatus
    | "cancelled"
    | "idled"
    | "retired"
    | "shelved"
    | "unknown";
  ticker?: string;
}

export interface FieldAsset extends BaseAsset {
  assetKind: "field";
  basin?: string;
  datasetId: "fields";
  fieldType?: "oil" | "gas" | "condensate" | "mixed";
  lat: number;
  lon: number;
  operator?: string;
  production_bpd?: number;
  reserves_mmboe?: number;
}

export interface TerminalAsset extends BaseAsset {
  assetKind: "terminal";
  capacity_bpd?: number;
  capacity_mtpa?: number;
  datasetId: "terminals";
  facilityType?: string;
  lat: number;
  lon: number;
  operator?: string;
  owner?: string;
  storageCap_mmbbl?: number;
  terminalRole?: "export" | "import";
  terminalType?: "export_terminal" | "import_terminal" | "port" | "storage_terminal" | "lng_terminal";
}

export interface ChokepointAsset extends BaseAsset {
  assetKind: "chokepoint";
  datasetId: "chokepoints";
  geometry: LineStringGeometry;
  status: "strategic";
  transitVolume_mbpd: number;
}

export type InfrastructureAsset =
  | RefineryAsset
  | PipelineAsset
  | FieldAsset
  | TerminalAsset
  | ChokepointAsset;

export interface FeatureCollectionPayload<TFeature> {
  _metadata: SourceMetadata;
  features: TFeature[];
  type: "FeatureCollection";
}

export interface PointFeature<TProperties> {
  geometry: {
    coordinates: [number, number];
    type: "Point";
  };
  id: string;
  properties: TProperties;
  type: "Feature";
}

export interface LineFeature<TProperties> {
  geometry: LineStringGeometry | MultiLineStringGeometry;
  id: string;
  properties: TProperties;
  type: "Feature";
}

export interface ReferenceCollection<TEntry> {
  _metadata: SourceMetadata;
  [key: string]: SourceMetadata | TEntry[];
}

export interface MapWorkspaceData {
  assets: InfrastructureAsset[];
  catalog: DatasetCatalogEntry[];
  companiesById: Record<string, CompanyProfile>;
  countriesByCode: Record<string, CountryProfile>;
  /**
   * Refinery ID → curated Hormuz crude feedstock entry. Sourced from
   * `public/data/reference/refinery_feedstock.json`. The refinery asset
   * itself carries the numeric `hormuzDependency` for map-paint
   * expressions; this map exposes the full entry (dominant grades, note,
   * bypassAccessible flag) for future panel surfaces.
   */
  feedstockById: Record<string, import("./refineryFeedstock").RefineryFeedstockEntry>;
  /**
   * Asset ID → curated FIRMS detection-count baseline (`mean`, `stdev`
   * over a rolling period). Sourced from
   * `public/data/firms/baselines.json`. Consumed by `useFirms` to
   * z-score each window's match count into NORMAL / ELEVATED / ALERT.
   * Empty when the baseline file is missing or unreadable — the hook
   * silently drops unscored facilities back to NORMAL in that case.
   */
  firmsBaselineByAssetId: Map<string, import("./firms").FirmsBaselineEntry>;
}

export interface DatasetFiltersById {
  chokepoints: {
    country: string;
    status: string;
    text: string;
  };
  fields: {
    country: string;
    status: string;
    text: string;
  };
  pipelines: {
    country: string;
    hydrocarbon: string;
    status: string;
    text: string;
  };
  refineries: {
    country: string;
    operator: string;
    status: string;
    text: string;
  };
  terminals: {
    country: string;
    status: string;
    text: string;
  };
}

export interface MapWorkspaceState {
  activeDatasetIds: DatasetId[];
  filtersByDataset: DatasetFiltersById;
  focusedDatasetId: DatasetId;
  searchQuery: string;
  selectedAssetId: string | null;
}

export interface AssetGridRow {
  asset: InfrastructureAsset;
  countryName: string;
  datasetLabel: string;
  name: string;
  primaryMetric: string;
  reference: string;
  secondaryMetric: string;
  status: string;
}
