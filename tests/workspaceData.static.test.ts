import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type RuntimeFeatureCollection = {
  _metadata?: {
    downloadDate?: string;
    license?: string;
    recordCount?: number;
    source?: string;
    sourceUrl?: string;
  };
  features: Array<{
    geometry?: {
      coordinates?: unknown;
      type?: string | null;
    } | null;
    properties?: Record<string, unknown>;
  }>;
  type: string;
};

describe("published workspace datasets", () => {
  it("publishes real field, terminal, pipeline, and refinery data instead of seed placeholders", () => {
    const refineries = loadCollection("public/data/infrastructure/refineries.geojson");
    const fields = loadCollection("public/data/infrastructure/fields.geojson");
    const terminals = loadCollection("public/data/infrastructure/terminals.geojson");
    const pipelines = loadCollection("public/data/infrastructure/pipelines.geojson");

    expect(refineries.type).toBe("FeatureCollection");
    expect(fields.type).toBe("FeatureCollection");
    expect(terminals.type).toBe("FeatureCollection");
    expect(pipelines.type).toBe("FeatureCollection");

    expect(refineries.features.length).toBeGreaterThan(20);
    expect(fields.features.length).toBeGreaterThan(0);
    expect(terminals.features.length).toBeGreaterThan(0);
    expect(pipelines.features.length).toBeGreaterThan(100);

    expect(refineries._metadata?.source).toContain("OGIM");
    expect(fields._metadata?.source).toContain("Global Energy Monitor");
    expect(terminals._metadata?.source).toContain("Global Energy Monitor");
    expect(pipelines._metadata?.source).toContain("Global Energy Monitor");
    expect(refineries._metadata?.source).not.toContain("seed");
    expect(pipelines._metadata?.source).not.toContain("seed");
  });

  it("publishes refineries as uniquely identified points", () => {
    const refineries = loadCollection("public/data/infrastructure/refineries.geojson");
    const featureIds = refineries.features
      .map((feature) => String(feature.properties?.id ?? ""))
      .filter(Boolean);

    expect(
      refineries.features.every((feature) => feature.geometry?.type === "Point")
    ).toBe(true);
    expect(featureIds).toHaveLength(refineries.features.length);
    expect(new Set(featureIds).size).toBe(featureIds.length);
  });

  it("publishes no refinery status, because the source does not provide one", () => {
    const refineries = loadCollection("public/data/infrastructure/refineries.geojson");

    expect(refineries.features.some((feature) => "status" in (feature.properties ?? {}))).toBe(false);
  });

  it("gives every layer the attribution the About page shows", () => {
    for (const name of ["refineries", "pipelines", "fields", "terminals"]) {
      const metadata = loadCollection(`public/data/infrastructure/${name}.geojson`)._metadata;

      expect(metadata?.source, name).toBeTruthy();
      expect(metadata?.downloadDate, name).toBeTruthy();
      expect(metadata?.license, name).toBeTruthy();
      expect(metadata?.sourceUrl, name).toMatch(/^https:\/\//);
    }
  });

  it("draws every pipeline as one connected route, with no pieces of other pipelines mixed in", () => {
    const pipelines = loadCollection("public/data/infrastructure/pipelines.geojson");
    const scattered = pipelines.features.filter((feature) => {
      const parts = (
        feature.geometry?.type === "MultiLineString" ? feature.geometry.coordinates : [feature.geometry?.coordinates]
      ) as Array<Array<[number, number]>>;

      // Every piece must come within 50 km of another piece of the same pipeline.
      return parts.some(
        (part, index) =>
          parts.length > 1 &&
          !parts.some(
            (other, otherIndex) =>
              otherIndex !== index && part.some((a) => other.some((b) => distanceKm(a, b) <= 50))
          )
      );
    });

    expect(scattered.map((feature) => feature.properties?.name)).toEqual([]);
  });

  it("credits OpenStreetMap for the pipeline routes taken from it", () => {
    const pipelines = loadCollection("public/data/infrastructure/pipelines.geojson");
    const routed = pipelines.features.filter((feature) => feature.properties?.routeSource === "OpenStreetMap");

    expect(routed.length).toBeGreaterThan(100);
    expect(pipelines._metadata?.source).toContain("OpenStreetMap");
    expect(pipelines._metadata?.license).toContain("ODbL");
    // Only built pipelines are matched to a real route.
    expect(routed.filter((feature) => ["proposed", "construction"].includes(String(feature.properties?.status)))).toEqual([]);
  });

  it("only publishes pipeline geometries that the map can render directly", () => {
    const pipelines = loadCollection("public/data/infrastructure/pipelines.geojson");

    expect(
      pipelines.features.every((feature) => {
        const type = feature.geometry?.type;

        return type === "LineString" || type === "MultiLineString";
      })
    ).toBe(true);
  });
});

describe("published reference data", () => {
  const countryProfiles = loadJson<{ countries: Array<{ code: string; name: string; source?: string }> }>(
    "public/data/reference/countries.json"
  ).countries;

  it("has a background note for every country that appears on the map", () => {
    const profileCodes = new Set(countryProfiles.map((country) => country.code));
    const mapCodes = new Set(
      ["refineries", "pipelines", "fields", "terminals"].flatMap((name) =>
        loadCollection(`public/data/infrastructure/${name}.geojson`).features.map((feature) =>
          String(feature.properties?.country)
        )
      )
    );

    expect([...mapCodes].filter((code) => !profileCodes.has(code))).toEqual([]);
  });

  it("names every crude grade's producer the way the country notes do, so they can link", () => {
    const countryNames = new Set(countryProfiles.map((country) => country.name));
    const grades = loadJson<{ grades: Array<{ name: string; producer: string }> }>(
      "public/data/reference/crude_grades.json"
    ).grades;

    expect(grades.filter((grade) => !countryNames.has(grade.producer)).map((grade) => grade.name)).toEqual([]);
  });

  it("names a source on every country note, operator note and crude grade", () => {
    const grades = loadJson<{ grades: Array<{ name: string; source?: string }> }>(
      "public/data/reference/crude_grades.json"
    ).grades;
    const companies = loadJson<{ companies: Array<{ name: string; source?: string }> }>(
      "public/data/reference/companies.json"
    ).companies;

    expect(
      [...countryProfiles, ...grades, ...companies].filter((entry) => !entry.source?.trim()).map((entry) => entry.name)
    ).toEqual([]);
  });

  it("carries only sourced fields on crude grades: no production, pricing or class", () => {
    const grades = loadJson<{ grades: Array<Record<string, unknown>> }>("public/data/reference/crude_grades.json").grades;

    expect([...new Set(grades.flatMap((grade) => Object.keys(grade)))].sort()).toEqual([
      "apiGravity",
      "id",
      "name",
      "note",
      "producer",
      "producerIso",
      "source",
      "sulfurPct"
    ]);
  });

  it("credits the refineries that are not from OGIM to their own source", () => {
    const ownSource = loadCollection("public/data/infrastructure/refineries.geojson").features.filter(
      (feature) => feature.properties?.source
    );

    expect(ownSource.map((feature) => feature.properties?.name).sort()).toEqual([
      "Al Zour Refinery",
      "Jazan Refinery",
      "Jubail (SATORP) Refinery",
      "Ruwais Refinery",
      "Sitra Refinery",
      "Yanbu (YASREF) Refinery"
    ]);
    expect(ownSource.every((feature) => feature.properties?.sourceDate)).toBe(true);
  });

  it("lists pipelines under Turkey, each with a source", () => {
    const turkish = loadCollection("public/data/infrastructure/pipelines.geojson").features.filter((feature) =>
      (feature.properties?.countries as string[]).includes("TR")
    );
    const added = turkish.filter((feature) => feature.properties?.country === "TR");

    expect(turkish.length).toBeGreaterThanOrEqual(7);
    expect(added.map((feature) => feature.properties?.name)).toEqual([
      "Baku-Tbilisi-Ceyhan Oil Pipeline",
      "Blue Stream Gas Pipeline",
      "TurkStream Gas Pipeline"
    ]);
    expect(added.every((feature) => /^EIA/.test(String(feature.properties?.source)))).toBe(true);
  });

  it("points every operator alias group's note at a company that exists", () => {
    const companyIds = new Set(
      loadJson<{ companies: Array<{ id: string }> }>("public/data/reference/companies.json").companies.map(
        (company) => company.id
      )
    );
    const aliases = loadJson<{ aliases: Array<{ canonicalSlug: string; curatedCompanyId?: string }> }>(
      "public/data/reference/operator_aliases.json"
    ).aliases;

    expect(
      aliases.filter((group) => group.curatedCompanyId && !companyIds.has(group.curatedCompanyId))
    ).toEqual([]);
  });
});

function distanceKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(toRadians(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(toRadians(lon2 - lon1) / 2) ** 2;

  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function loadJson<TPayload>(path: string): TPayload {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as TPayload;
}

function loadCollection(path: string): RuntimeFeatureCollection {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as RuntimeFeatureCollection;
}
