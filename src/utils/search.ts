import type { CrudeGrade } from "../types/CrudeGrade";
import type { InfrastructureAsset } from "../types/Infrastructure";
import { buildSearchResults, getAssetDisplayName, getAssetTypeLabel } from "./infrastructure";
import type { CountryEntry, OperatorEntry } from "./referenceIndex";

/** Where picking a search result takes the reader. */
export type SearchTarget =
  | { asset: InfrastructureAsset; kind: "asset" }
  | { id: string; kind: "reference"; tab: "countries" | "operators" | "grades" };

/** One row in the header search: an asset on the map or an entry in the Reference view. */
export interface SearchResult {
  /** Unique within one result list. */
  key: string;
  /** Second line: what kind of thing this is, and one fact to tell it apart. */
  meta: string;
  name: string;
  target: SearchTarget;
}

interface SearchSources {
  assets: InfrastructureAsset[];
  countries: CountryEntry[];
  grades: CrudeGrade[];
  /** Listed in the order given, so pass them with the most assets first. */
  operators: OperatorEntry[];
}

export const MAX_SEARCH_RESULTS = 8;

// Reference entries are listed first, so they are capped to leave room
// for assets: "kuwait" should not show only companies with Kuwait in the name.
const MAX_REFERENCE_RESULTS = 4;

/**
 * Everything the header search can open for `query`. Countries, grades and
 * operators match on their name; assets match on name, country, operator
 * and type, as they always have.
 */
export function buildWorkspaceSearchResults(query: string, sources: SearchSources): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery === "") {
    return [];
  }

  const nameMatches = (name: string) => name.toLowerCase().includes(normalizedQuery);

  const referenceResults: SearchResult[] = [
    ...sources.countries
      .filter((country) => nameMatches(country.name))
      .map((country) => ({
        key: `country:${country.code}`,
        meta: `COUNTRY | ${formatAssetCount(country.assets.length)}`,
        name: country.name,
        target: { id: country.code, kind: "reference" as const, tab: "countries" as const }
      })),
    ...sources.grades
      .filter((grade) => nameMatches(grade.name))
      .map((grade) => ({
        key: `grade:${grade.id}`,
        meta: `CRUDE GRADE | ${grade.producer.toUpperCase()}`,
        name: grade.name,
        target: { id: grade.id, kind: "reference" as const, tab: "grades" as const }
      })),
    ...sources.operators
      .filter((operator) => nameMatches(operator.name))
      .map((operator) => ({
        key: `operator:${operator.id}`,
        meta: `OPERATOR | ${formatAssetCount(operator.assets.length)}`,
        name: operator.name,
        target: { id: operator.id, kind: "reference" as const, tab: "operators" as const }
      }))
  ].slice(0, MAX_REFERENCE_RESULTS);

  const assetResults: SearchResult[] = buildSearchResults(sources.assets, query).map((asset) => ({
    key: `asset:${asset.id}`,
    meta: `${getAssetTypeLabel(asset)} | ${asset.countryName.toUpperCase()}`,
    name: getAssetDisplayName(asset),
    target: { asset, kind: "asset" }
  }));

  return [...referenceResults, ...assetResults].slice(0, MAX_SEARCH_RESULTS);
}

function formatAssetCount(count: number) {
  return count === 1 ? "1 ASSET" : `${count} ASSETS`;
}
