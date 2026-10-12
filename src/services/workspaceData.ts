import { DATASET_CATALOG_SEED } from "../constants/datasetCatalog";
import type {
  CompanyProfile,
  CountryProfile,
  DatasetCatalogEntry,
  DatasetId,
  FeatureCollectionPayload,
  FieldAsset,
  InfrastructureAsset,
  LineFeature,
  MapWorkspaceData,
  OperatorAliasGroup,
  PipelineAsset,
  PointFeature,
  RefineryAsset,
  SourceMetadata,
  TerminalAsset
} from "../types/Infrastructure";

// The trackers list projects that were proposed and then abandoned. They
// were never built, so they are not infrastructure and are dropped at load
// time for every GEM dataset. Retired / mothballed / idle assets physically
// exist and are kept; the map draws them faded.
const NEVER_BUILT_STATUSES: ReadonlySet<string> = new Set(["cancelled", "shelved"]);

// A record that is not from its layer's dataset names its own source.
interface OwnSource {
  source?: string;
  sourceDate?: string;
}

type RefineryFeature = PointFeature<Omit<RefineryAsset, "_metadata" | "assetKind" | "datasetId"> & OwnSource>;
type PipelineFeature = LineFeature<
  Omit<PipelineAsset, "_metadata" | "assetKind" | "datasetId" | "geometry"> & OwnSource
>;
type FieldFeature = PointFeature<Omit<FieldAsset, "_metadata" | "assetKind" | "datasetId">>;
type TerminalFeature = PointFeature<Omit<TerminalAsset, "_metadata" | "assetKind" | "datasetId">>;

interface CompanyReferencePayload {
  companies: CompanyProfile[];
}

interface CountryReferencePayload {
  countries: CountryProfile[];
}

interface OperatorAliasPayload {
  aliases: OperatorAliasGroup[];
}

export async function loadMapWorkspaceData(): Promise<MapWorkspaceData> {
  const [refineries, pipelines, fields, terminals, companyProfiles, countryProfiles, operatorAliases] = await Promise.all([
    loadGeoJson<RefineryFeature>("/data/infrastructure/refineries.geojson"),
    loadGeoJson<PipelineFeature>("/data/infrastructure/pipelines.geojson"),
    loadGeoJson<FieldFeature>("/data/infrastructure/fields.geojson"),
    loadGeoJson<TerminalFeature>("/data/infrastructure/terminals.geojson"),
    loadJson<CompanyReferencePayload>("/data/reference/companies.json"),
    loadJson<CountryReferencePayload>("/data/reference/countries.json"),
    loadJson<OperatorAliasPayload>("/data/reference/operator_aliases.json")
  ]);

  const assets: InfrastructureAsset[] = [
    // Refineries have no status field to filter on.
    ...refineries.features.map((feature) => ({
      ...withSource(feature.properties, refineries._metadata),
      assetKind: "refinery" as const,
      datasetId: "refineries" as const
    })),
    ...builtFeatures(pipelines).map((feature) => ({
      ...withSource(feature.properties, pipelines._metadata),
      assetKind: "pipeline" as const,
      datasetId: "pipelines" as const,
      geometry: feature.geometry
    })),
    ...builtFeatures(fields).map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(fields._metadata),
      assetKind: "field" as const,
      datasetId: "fields" as const
    })),
    ...builtFeatures(terminals).map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(terminals._metadata),
      assetKind: "terminal" as const,
      datasetId: "terminals" as const
    }))
  ];

  return {
    assets,
    catalog: buildCatalog(assets, {
      fields: fields._metadata,
      pipelines: pipelines._metadata,
      refineries: refineries._metadata,
      terminals: terminals._metadata
    }),
    companies: companyProfiles.companies,
    countryProfiles: countryProfiles.countries,
    operatorAliases: operatorAliases.aliases
  };
}

function builtFeatures<TFeature extends { properties: { status: string } }>(
  collection: FeatureCollectionPayload<TFeature>
): TFeature[] {
  return collection.features.filter((feature) => !NEVER_BUILT_STATUSES.has(feature.properties.status));
}

function buildCatalog(
  assets: InfrastructureAsset[],
  metadataById: Record<DatasetId, SourceMetadata>
): DatasetCatalogEntry[] {
  return DATASET_CATALOG_SEED.map((entry) => {
    const metadata = metadataById[entry.id];

    return {
      ...entry,
      downloadDate: metadata.downloadDate,
      license: metadata.license,
      recordCount: assets.filter((asset) => asset.datasetId === entry.id).length,
      source: metadata.source,
      sourceUrl: metadata.sourceUrl
    };
  });
}

/** The record's fields plus its attribution: its own source when it names one, else its layer's. */
function withSource<TProperties extends OwnSource>(
  { source, sourceDate, ...properties }: TProperties,
  layer: SourceMetadata
) {
  return {
    ...properties,
    _metadata: { downloadDate: sourceDate ?? layer.downloadDate, source: source ?? layer.source }
  };
}

function metadataForFeature(metadata: SourceMetadata) {
  return {
    downloadDate: metadata.downloadDate,
    source: metadata.source
  };
}

async function loadGeoJson<TFeature>(path: string): Promise<FeatureCollectionPayload<TFeature>> {
  const payload = await loadJson<FeatureCollectionPayload<TFeature>>(path);

  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features) || !payload._metadata) {
    throw new Error(`Invalid GeoJSON payload at ${path}`);
  }

  return payload;
}

async function loadJson<TPayload>(path: string): Promise<TPayload> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  return (await response.json()) as TPayload;
}
