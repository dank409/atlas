import { DATASET_CATALOG_SEED } from "../constants/datasetCatalog";
import { loadRefineryFeedstockSnapshot } from "./refineryFeedstock";
import type {
  ChokepointAsset,
  CompanyProfile,
  CountryProfile,
  DatasetCatalogEntry,
  FeatureCollectionPayload,
  FieldAsset,
  InfrastructureAsset,
  LineStringGeometry,
  LineFeature,
  MapWorkspaceData,
  MultiLineStringGeometry,
  PipelineAsset,
  PipelineGeometryConfidence,
  PointFeature,
  RefineryAsset,
  TerminalAsset
} from "../types/Infrastructure";
import type { RefineryFeedstockEntry } from "../types/refineryFeedstock";
import type { FirmsBaselineEntry } from "../types/firms";

// GEM ships pipelines in several states that do not correspond to physical
// infrastructure. We drop these at load time so they never render on the map
// or show up in the grid. "proposed" and "construction" are kept because they
// represent real planned/active projects users want to see.
const PIPELINE_STATUSES_TO_EXCLUDE: ReadonlySet<string> = new Set([
  "cancelled",
  "shelved",
  "retired",
  "mothballed",
  "idle",
  "idled",
  "decommissioned"
]);

// Straight 2-point lines longer than this are almost certainly GEM's schematic
// "we know the endpoints but not the route" placeholder (e.g. the 2000km
// straight line from Pakistan to China that cuts across Afghanistan). Rendered
// as dashed + dimmed so the user can see they exist without trusting the path.
const SCHEMATIC_STRAIGHT_LINE_MIN_KM = 300;

type RefineryFeature = PointFeature<Omit<RefineryAsset, "_metadata" | "assetKind" | "datasetId">>;
type PipelineFeature = LineFeature<Omit<PipelineAsset, "_metadata" | "assetKind" | "datasetId">>;
type ChokepointFeature = {
  geometry: LineStringGeometry;
  id: string;
  properties: Omit<ChokepointAsset, "_metadata" | "assetKind" | "datasetId">;
  type: "Feature";
};
type FieldFeature = PointFeature<Omit<FieldAsset, "_metadata" | "assetKind" | "datasetId">>;
type TerminalFeature = PointFeature<Omit<TerminalAsset, "_metadata" | "assetKind" | "datasetId">>;

interface CompanyReferencePayload {
  _metadata: {
    downloadDate: string;
    recordCount: number;
    source: string;
  };
  companies: CompanyProfile[];
}

interface CountryReferencePayload {
  _metadata: {
    downloadDate: string;
    recordCount: number;
    source: string;
  };
  countries: CountryProfile[];
}

interface FirmsBaselinePayload {
  _metadata?: { asOf?: string; source?: string };
  baselines?: Record<string, FirmsBaselineEntry>;
}

export async function loadMapWorkspaceData(): Promise<MapWorkspaceData> {
  const [
    refineries,
    pipelines,
    fields,
    terminals,
    chokepoints,
    companyProfiles,
    countryProfiles,
    feedstockSnapshot,
    firmsBaselinePayload
  ] = await Promise.all([
    loadGeoJson<RefineryFeature>("/data/infrastructure/refineries.geojson"),
    loadGeoJson<PipelineFeature>("/data/infrastructure/pipelines.geojson"),
    loadGeoJson<FieldFeature>("/data/infrastructure/fields.geojson"),
    loadGeoJson<TerminalFeature>("/data/infrastructure/terminals.geojson"),
    loadGeoJson<ChokepointFeature>("/data/reference/chokepoints.geojson"),
    loadJson<CompanyReferencePayload>("/data/reference/companies.json"),
    loadJson<CountryReferencePayload>("/data/reference/countries.json"),
    loadRefineryFeedstockSnapshot(),
    loadJson<FirmsBaselinePayload>("/data/firms/baselines.json").catch(
      () => ({ baselines: {} }) as FirmsBaselinePayload
    )
  ]);

  const cleanedPipelineFeatures = pipelines.features.filter(
    (feature) => !PIPELINE_STATUSES_TO_EXCLUDE.has(String(feature.properties.status))
  );
  const cleanedPipelineCount = cleanedPipelineFeatures.length;

  const feedstockById: Record<string, RefineryFeedstockEntry> = Object.fromEntries(
    feedstockSnapshot.entries.map((entry) => [entry.refineryId, entry])
  );

  // Dev-time coverage check. Refinery IDs present in the GeoJSON but
  // missing a curated feedstock score default to hormuzDependency = 0
  // ("assume resilient") — that's the right behaviour at the map layer
  // but we still warn the curator so the gap is visible. Only fires in
  // DEV builds so production bundles stay silent.
  if (import.meta.env.DEV) {
    const missingIds = refineries.features
      .map((feature) => feature.properties.id)
      .filter((id): id is string => typeof id === "string" && !feedstockById[id]);
    if (missingIds.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[workspaceData] ${missingIds.length} refineries lack a feedstock entry:`,
        missingIds
      );
    }

    // Country-profile coverage check. Any refinery whose ISO country
    // code is absent from countries.json will fall back to the
    // UNMAPPED COUNTRY placeholder in ContextPanelStack. Non-ME
    // countries (EG / IN / JO / PK / SY / TR) are expected misses per
    // CLAUDE.md P1 #19 scope — their presence in this warning is
    // correct behaviour rather than a data bug, and the log line
    // makes the scope explicit to future curators.
    const countryCodesInProfiles = new Set(
      countryProfiles.countries.map((country) => country.code)
    );
    const missingCountryCodes = Array.from(
      new Set(
        refineries.features
          .map((feature) => feature.properties.country)
          .filter(
            (code): code is string =>
              typeof code === "string" && !countryCodesInProfiles.has(code)
          )
      )
    );
    if (missingCountryCodes.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[workspaceData] refineries present for countries without a CountryProfile:`,
        missingCountryCodes
      );
    }
  }

  const assets: InfrastructureAsset[] = [
    ...refineries.features.map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(refineries._metadata),
      assetKind: "refinery" as const,
      datasetId: "refineries" as const,
      hormuzDependency: feedstockById[feature.properties.id]?.hormuzDependency
    })),
    ...cleanedPipelineFeatures.map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(pipelines._metadata),
      assetKind: "pipeline" as const,
      datasetId: "pipelines" as const,
      geometry: feature.geometry,
      geometryConfidence: classifyPipelineGeometryConfidence(feature.geometry)
    })),
    ...fields.features.map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(fields._metadata),
      assetKind: "field" as const,
      datasetId: "fields" as const
    })),
    ...terminals.features.map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(terminals._metadata),
      assetKind: "terminal" as const,
      datasetId: "terminals" as const
    })),
    ...chokepoints.features.map((feature) => ({
      ...feature.properties,
      _metadata: metadataForFeature(chokepoints._metadata),
      assetKind: "chokepoint" as const,
      datasetId: "chokepoints" as const,
      geometry: feature.geometry
    }))
  ];

  const firmsBaselineByAssetId = new Map(
    Object.entries(firmsBaselinePayload.baselines ?? {})
  );

  return {
    assets,
    catalog: buildCatalog({
      chokepoints: chokepoints._metadata.recordCount,
      fields: fields._metadata.recordCount,
      pipelines: cleanedPipelineCount,
      refineries: refineries._metadata.recordCount,
      terminals: terminals._metadata.recordCount
    }),
    companiesById: Object.fromEntries(companyProfiles.companies.map((company) => [company.id, company])),
    countriesByCode: Object.fromEntries(countryProfiles.countries.map((country) => [country.code, country])),
    feedstockById,
    firmsBaselineByAssetId
  };
}

function buildCatalog(recordCounts: Record<DatasetCatalogEntry["id"], number>): DatasetCatalogEntry[] {
  return DATASET_CATALOG_SEED.map((entry) => ({
    ...entry,
    recordCount: recordCounts[entry.id] ?? 0
  }));
}

function classifyPipelineGeometryConfidence(
  geometry: LineStringGeometry | MultiLineStringGeometry
): PipelineGeometryConfidence {
  // A surveyed pipeline has intermediate waypoints. A "schematic" 2-point
  // LineString is only suspicious when the straight-line distance is long
  // enough that the actual route could plausibly deviate from a great circle
  // across mountains, borders, or sea. Short 2-point lines are fine as-is.
  if (geometry.type === "LineString") {
    if (geometry.coordinates.length > 2) {
      return "high";
    }

    if (geometry.coordinates.length < 2) {
      return "low";
    }

    const [start, end] = geometry.coordinates;
    return haversineKm(start, end) >= SCHEMATIC_STRAIGHT_LINE_MIN_KM ? "low" : "high";
  }

  // MultiLineString: if any segment has waypoints, trust the whole route.
  // Otherwise treat as schematic iff the longest segment is over the threshold.
  const hasWaypoints = geometry.coordinates.some((segment) => segment.length > 2);

  if (hasWaypoints) {
    return "high";
  }

  const maxSpanKm = Math.max(
    0,
    ...geometry.coordinates
      .filter((segment) => segment.length === 2)
      .map((segment) => haversineKm(segment[0], segment[1]))
  );

  return maxSpanKm >= SCHEMATIC_STRAIGHT_LINE_MIN_KM ? "low" : "high";
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const earthRadiusKm = 6371;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);
  const h =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function metadataForFeature(metadata: { downloadDate: string; source: string }) {
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
