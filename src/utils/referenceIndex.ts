import type { CrudeGrade } from "../types/CrudeGrade";
import type {
  CompanyProfile,
  CountryProfile,
  InfrastructureAsset,
  OperatorAliasGroup
} from "../types/Infrastructure";
import { getAssetOperator } from "./infrastructure";

// The Reference tab is built from the same assets the map shows. These
// functions group them by operator and by country, and find the assets a
// piece of reference text names, so every entry can link to the map.

export interface OperatorEntry {
  assets: InfrastructureAsset[];
  /** Countries the operator has assets in, most assets first. */
  countryCodes: string[];
  id: string;
  name: string;
  /** Total length of its pipelines that report a length. */
  pipelineLengthKm: number;
  /** Hand-written background note, for the few operators that have one. */
  profile: CompanyProfile | null;
  /** Total capacity of its refineries that report one. */
  refiningCapacityBpd: number;
}

export interface OperatorIndex {
  operatorIdByAssetId: Record<string, string>;
  operators: OperatorEntry[];
}

export interface CountryEntry {
  assets: InfrastructureAsset[];
  code: string;
  name: string;
  /** Operators with assets in the country, most assets first. */
  operatorIds: string[];
  /** Hand-written background note, where one exists. */
  profile: CountryProfile | null;
  /** Total capacity of its refineries that report one. */
  refiningCapacityBpd: number;
}

const CORPORATE_SUFFIXES = new Set(["co", "company", "corp", "corporation", "ltd", "limited", "llc", "inc"]);

// Placeholder strings the sources use when they do not name anyone.
const UNNAMED_OPERATOR_KEYS = new Set(["", "unknown", "n a"]);

/**
 * Key for deciding whether two operator strings are the same name. Ignores
 * case, punctuation, `&` versus `and`, bracketed asides and trailing corporate
 * suffixes, so `Apache Corp`, `Apache Corporation` and `APACHE` all match. This is purely
 * mechanical: it never decides that two differently named companies are one.
 */
export function normalizeOperatorName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  while (tokens.length > 1 && CORPORATE_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ");
}

function sumBy<TItem>(items: TItem[], getValue: (item: TItem) => number | undefined) {
  return items.reduce((total, item) => total + (getValue(item) ?? 0), 0);
}

/** Keys ordered by how many times they occur, most first; ties keep first-seen order. */
function rankByCount(keys: string[]): string[] {
  const counts = new Map<string, number>();

  keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([key]) => key);
}

function isAllUppercase(value: string) {
  return value === value.toUpperCase();
}

/** The spelling to show for a group: the commonest one, preferring mixed case on a tie. */
function pickDisplayName(spellings: string[]): string {
  const counts = new Map<string, number>();

  spellings.forEach((spelling) => counts.set(spelling, (counts.get(spelling) ?? 0) + 1));

  return Array.from(counts.entries()).sort(
    (left, right) => right[1] - left[1] || Number(isAllUppercase(left[0])) - Number(isAllUppercase(right[0]))
  )[0][0];
}

/**
 * Groups assets by the operator (or owner) the source names for them.
 * Spelling variants merge mechanically; the alias groups additionally merge
 * known brand variants of one company (Saudi Aramco / Saudi Arabian Oil).
 * Assets with no named operator are left out.
 */
export function buildOperatorIndex(
  assets: InfrastructureAsset[],
  aliasGroups: OperatorAliasGroup[],
  companies: CompanyProfile[]
): OperatorIndex {
  const aliasGroupByKey = new Map<string, OperatorAliasGroup>();

  aliasGroups.forEach((group) => {
    [group.displayName, ...group.variants].forEach((variant) => {
      aliasGroupByKey.set(normalizeOperatorName(variant), group);
    });
  });

  const grouped = new Map<string, { aliasGroup?: OperatorAliasGroup; assets: InfrastructureAsset[]; spellings: string[] }>();
  const operatorIdByAssetId: Record<string, string> = {};

  assets.forEach((asset) => {
    const spelling = getAssetOperator(asset);
    const key = spelling ? normalizeOperatorName(spelling) : "";

    if (!spelling || UNNAMED_OPERATOR_KEYS.has(key)) {
      return;
    }

    const aliasGroup = aliasGroupByKey.get(key);
    const id = aliasGroup ? aliasGroup.canonicalSlug : key.replaceAll(" ", "-");
    const group = grouped.get(id) ?? { aliasGroup, assets: [], spellings: [] };

    group.assets.push(asset);
    group.spellings.push(spelling);
    grouped.set(id, group);
    operatorIdByAssetId[asset.id] = id;
  });

  const operators = Array.from(grouped.entries())
    .map(([id, group]): OperatorEntry => ({
      assets: group.assets,
      countryCodes: rankByCount(group.assets.map((asset) => asset.country)),
      id,
      name: group.aliasGroup?.displayName ?? pickDisplayName(group.spellings),
      pipelineLengthKm: sumBy(group.assets, (asset) => (asset.assetKind === "pipeline" ? asset.length_km : 0)),
      profile: companies.find((company) => company.id === group.aliasGroup?.curatedCompanyId) ?? null,
      refiningCapacityBpd: sumBy(group.assets, (asset) => (asset.assetKind === "refinery" ? asset.capacity_bpd : 0))
    }))
    .sort((left, right) => right.assets.length - left.assets.length || left.name.localeCompare(right.name));

  return { operatorIdByAssetId, operators };
}

/**
 * One entry per country that has assets on the map or a background note.
 * An asset belongs to its primary country; a pipeline also belongs to
 * every other country it is listed in.
 */
export function buildCountryIndex(
  assets: InfrastructureAsset[],
  profiles: CountryProfile[],
  operatorIdByAssetId: Record<string, string>
): CountryEntry[] {
  const nameByCode = new Map<string, string>();

  profiles.forEach((profile) => nameByCode.set(profile.code, profile.name));
  assets.forEach((asset) => {
    if (!nameByCode.has(asset.country)) {
      nameByCode.set(asset.country, asset.countryName);
    }
  });

  return Array.from(nameByCode.entries())
    .map(([code, name]): CountryEntry => {
      const countryAssets = assets.filter(
        (asset) => asset.country === code || (asset.assetKind === "pipeline" && asset.countries?.includes(code))
      );

      return {
        assets: countryAssets,
        code,
        name,
        operatorIds: rankByCount(
          countryAssets.flatMap((asset) => (operatorIdByAssetId[asset.id] ? [operatorIdByAssetId[asset.id]] : []))
        ),
        profile: profiles.find((profile) => profile.code === code) ?? null,
        refiningCapacityBpd: sumBy(countryAssets, (asset) => (asset.assetKind === "refinery" ? asset.capacity_bpd : 0))
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The grade table names producers by country name; match it to a country entry. */
export function findGradeCountry<TCountry extends { name: string }>(
  grade: CrudeGrade,
  countries: TCountry[]
): TCountry | null {
  return countries.find((country) => country.name.toLowerCase() === grade.producer.toLowerCase()) ?? null;
}

// Longest first, so "oil and gas field" is removed before "field".
const ASSET_NAME_SUFFIXES = [
  "gas and condensate field",
  "oil and gas field",
  "crude oil pipeline",
  "products pipeline",
  "condensate field",
  "oil pipelines",
  "oil pipeline",
  "gas pipeline",
  "ngl pipeline",
  "flng terminal",
  "lng terminal",
  "oil field",
  "gas field",
  "pipeline",
  "refinery",
  "terminal",
  "field",
  "fsru"
];

// Shorter place names ("Bab", "Arab", "Zohr") match too much ordinary text.
const MIN_MENTION_LENGTH = 5;

/** Lower-case, with typographic dashes folded to hyphens so "Kirkuk–Ceyhan" matches "Kirkuk-Ceyhan". */
function foldForMatching(text: string) {
  return text.toLowerCase().replace(/[‐-―]/g, "-");
}

/** `Marjan Oil and Gas Field (Saudi Arabia)` → `marjan`. */
function getPlaceName(assetName: string): string {
  const folded = foldForMatching(assetName.replace(/\([^)]*\)/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  const suffix = ASSET_NAME_SUFFIXES.find((candidate) => folded.endsWith(` ${candidate}`));

  return suffix ? folded.slice(0, -suffix.length - 1).trim() : folded;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Assets whose place name appears as whole words in `text`. Used to link a
 * hand-written note to the map: a grade note that says "Safaniya" links to
 * the Safaniya field. Pass only the assets that could sensibly be meant
 * (same country), and the names to ignore (country names, so "Yemen" in a
 * sentence does not link to "Yemen LNG Terminal").
 */
export function findMentionedAssets(
  text: string,
  candidates: InfrastructureAsset[],
  ignoredNames: string[] = []
): InfrastructureAsset[] {
  const haystack = foldForMatching(text);
  const ignored = new Set(ignoredNames.map(foldForMatching));

  return candidates.filter((asset) => {
    const placeName = getPlaceName(asset.name);

    if (placeName.length < MIN_MENTION_LENGTH || ignored.has(placeName)) {
      return false;
    }

    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(placeName)}(?![\\p{L}\\p{N}])`, "u").test(haystack);
  });
}
