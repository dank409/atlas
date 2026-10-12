export type DatasetId = "refineries" | "pipelines" | "fields" | "terminals";

// Shape of the `_metadata` block every published data file carries.
// Shown verbatim in the UI so each dataset's provenance stays visible.
export interface SourceMetadata {
  source: string;
  downloadDate: string;
  recordCount: number;
  license?: string;
  sourceUrl?: string;
  notes?: string;
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
  downloadDate: string;
  id: DatasetId;
  license?: string;
  /** Assets loaded into the app, after never-built projects are dropped. */
  recordCount: number;
  source: string;
  sourceUrl?: string;
  title: string;
}

/** Background note on one of the larger operators. */
export interface CompanyProfile {
  domicile: string;
  id: string;
  name: string;
  source: string;
  summary: string;
  updated: string;
  website: string;
}

/** Background note on a country. Carries no figures the map data also has. */
export interface CountryProfile {
  code: string;
  /** How the country's oil and gas reach export markets. */
  exportRoutes: string;
  /** Named export terminals. Mostly crude terminals, which are not a map layer. */
  keyExportTerminals?: string[];
  name: string;
  source: string;
  summary: string;
  updated: string;
}

/**
 * Spellings of one company's name as they appear in the source data.
 * Only variants of the same legal entity are grouped; subsidiaries are
 * not rolled up into their parents.
 */
export interface OperatorAliasGroup {
  canonicalSlug: string;
  /** Id in companies.json when a background note exists for this operator. */
  curatedCompanyId?: string;
  displayName: string;
  variants: string[];
}

export interface BaseAsset {
  _metadata: Pick<SourceMetadata, "downloadDate" | "source">;
  assetKind: "refinery" | "pipeline" | "field" | "terminal";
  country: string;
  countryName: string;
  datasetId: DatasetId;
  id: string;
  name: string;
}

// Refineries carry no status: OGIM does not publish one for this region.
export interface RefineryAsset extends BaseAsset {
  assetKind: "refinery";
  capacity_bpd?: number;
  datasetId: "refineries";
  lat: number;
  lon: number;
  operator: string;
}

export type PipelineHydrocarbon = "crude_oil" | "natural_gas" | "ngl";

export interface PipelineAsset extends BaseAsset {
  assetKind: "pipeline";
  capacity_boed?: number;
  countries?: string[];
  datasetId: "pipelines";
  diameter_inches?: number;
  endPoint?: string;
  geometry: LineStringGeometry | MultiLineStringGeometry;
  hydrocarbon: PipelineHydrocarbon;
  length_km?: number;
  owner: string;
  segmentName?: string;
  startPoint?: string;
  /** Project status as published by GEM, e.g. `operating`, `proposed`. */
  status: string;
}

export interface FieldAsset extends BaseAsset {
  assetKind: "field";
  basin?: string | null;
  datasetId: "fields";
  fieldType?: "oil" | "gas" | "mixed";
  lat: number;
  lon: number;
  operator?: string | null;
  /** Oil and gas combined, in barrels of oil equivalent per day, for GEM's latest data year. */
  production_bpd?: number;
  /** Project status as published by GEM. */
  status: string;
}

export interface TerminalAsset extends BaseAsset {
  assetKind: "terminal";
  capacity_mtpa?: number;
  datasetId: "terminals";
  lat: number;
  lon: number;
  operator?: string | null;
  owner?: string | null;
  /** Project status as published by GEM. */
  status: string;
  terminalRole?: "export" | "import";
}

export type InfrastructureAsset = RefineryAsset | PipelineAsset | FieldAsset | TerminalAsset;

export type PointAsset = RefineryAsset | FieldAsset | TerminalAsset;

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

export interface MapWorkspaceData {
  assets: InfrastructureAsset[];
  catalog: DatasetCatalogEntry[];
  companies: CompanyProfile[];
  countryProfiles: CountryProfile[];
  operatorAliases: OperatorAliasGroup[];
}
