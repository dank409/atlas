import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMapWorkspaceData } from "./workspaceData";

function collection(source: string, features: unknown[]) {
  return {
    _metadata: {
      downloadDate: "2025-03-28",
      license: "CC BY 4.0",
      recordCount: features.length,
      source,
      sourceUrl: "https://example.org/data"
    },
    features,
    type: "FeatureCollection"
  };
}

// Refinery features carry no status; pass undefined for those.
function pointFeature(id: string, status?: string) {
  return {
    geometry: { coordinates: [48.3, 30.35], type: "Point" },
    id,
    properties: { country: "IR", countryName: "Iran", id, lat: 30.35, lon: 48.3, name: id, ...(status ? { status } : {}) },
    type: "Feature"
  };
}

function lineFeature(id: string, status: string, coordinates: number[][]) {
  return {
    geometry: { coordinates, type: "LineString" },
    id,
    properties: { country: "SA", countryName: "Saudi Arabia", hydrocarbon: "crude_oil", id, name: id, owner: "x", status },
    type: "Feature"
  };
}

const PAYLOADS: Record<string, unknown> = {
  "/data/infrastructure/fields.geojson": collection("GEM fields", [
    pointFeature("field-a", "operating"),
    pointFeature("field-b", "cancelled")
  ]),
  "/data/infrastructure/pipelines.geojson": collection("GEM pipelines", [
    lineFeature("pipeline-surveyed", "operating", [
      [49.6, 25.9],
      [44.0, 24.5],
      [38.1, 24.1]
    ]),
    lineFeature("pipeline-schematic", "proposed", [
      [49.6, 25.9],
      [38.1, 24.1]
    ]),
    lineFeature("pipeline-short", "retired", [
      [49.6, 25.9],
      [49.9, 26.0]
    ]),
    lineFeature("pipeline-shelved", "shelved", [
      [49.6, 25.9],
      [49.9, 26.0]
    ])
  ]),
  "/data/infrastructure/refineries.geojson": collection("OGIM", [
    pointFeature("refinery-a"),
    // Not from the layer's dataset: carries its own source.
    {
      ...pointFeature("refinery-b"),
      properties: { ...pointFeature("refinery-b").properties, source: "EIA brief", sourceDate: "2023-07" }
    }
  ]),
  "/data/infrastructure/terminals.geojson": collection("GEM terminals", [
    pointFeature("terminal-a", "operating"),
    pointFeature("terminal-b", "cancelled"),
    pointFeature("terminal-c", "mothballed")
  ]),
  "/data/reference/companies.json": { companies: [{ id: "adnoc", name: "ADNOC" }] },
  "/data/reference/countries.json": { countries: [{ code: "IR", name: "Iran" }] },
  "/data/reference/operator_aliases.json": {
    aliases: [{ canonicalSlug: "adnoc", curatedCompanyId: "adnoc", displayName: "ADNOC", variants: ["ADNOC"] }]
  }
};

function stubFetch(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      const payload = { ...PAYLOADS, ...overrides }[path];

      return payload === undefined ? { ok: false, status: 404 } : { json: async () => payload, ok: true };
    })
  );
}

describe("loadMapWorkspaceData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tags every asset with its layer and source metadata", async () => {
    stubFetch();
    const { assets } = await loadMapWorkspaceData();
    const refinery = assets.find((asset) => asset.id === "refinery-a");

    expect(refinery).toMatchObject({
      _metadata: { downloadDate: "2025-03-28", source: "OGIM" },
      assetKind: "refinery",
      datasetId: "refineries"
    });
    expect(refinery).not.toHaveProperty("status");
  });

  it("credits a record to its own source when it names one", async () => {
    stubFetch();
    const { assets } = await loadMapWorkspaceData();
    const refinery = assets.find((asset) => asset.id === "refinery-b");

    expect(refinery?._metadata).toEqual({ downloadDate: "2023-07", source: "EIA brief" });
    expect(refinery).not.toHaveProperty("source");
    expect(refinery).not.toHaveProperty("sourceDate");
  });

  it("drops never-built projects from every layer but keeps retired and mothballed assets", async () => {
    stubFetch();
    const { assets } = await loadMapWorkspaceData();
    const ids = assets.map((asset) => asset.id);

    expect(ids).not.toContain("field-b");
    expect(ids).not.toContain("terminal-b");
    expect(ids).not.toContain("pipeline-shelved");
    expect(ids).toContain("pipeline-short");
    expect(ids).toContain("terminal-c");
  });

  it("builds the catalog from file metadata and counts only loaded assets", async () => {
    stubFetch();
    const { catalog } = await loadMapWorkspaceData();

    expect(catalog.map((entry) => [entry.id, entry.recordCount])).toEqual([
      ["refineries", 2],
      ["pipelines", 3],
      ["fields", 1],
      ["terminals", 2]
    ]);
    expect(catalog[0]).toMatchObject({
      downloadDate: "2025-03-28",
      license: "CC BY 4.0",
      source: "OGIM",
      sourceUrl: "https://example.org/data"
    });
  });

  it("passes through the hand-written profiles and the operator name map", async () => {
    stubFetch();
    const { companies, countryProfiles, operatorAliases } = await loadMapWorkspaceData();

    expect(companies.map((company) => company.id)).toEqual(["adnoc"]);
    expect(countryProfiles.map((country) => country.code)).toEqual(["IR"]);
    expect(operatorAliases[0].variants).toEqual(["ADNOC"]);
  });

  it("rejects when a data file is missing or is not a metadata-tagged FeatureCollection", async () => {
    stubFetch({ "/data/infrastructure/fields.geojson": undefined });
    await expect(loadMapWorkspaceData()).rejects.toThrow("Failed to load /data/infrastructure/fields.geojson: 404");

    stubFetch({ "/data/infrastructure/fields.geojson": { features: [], type: "FeatureCollection" } });
    await expect(loadMapWorkspaceData()).rejects.toThrow("Invalid GeoJSON payload");
  });
});
