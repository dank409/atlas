import { loadMapWorkspaceData } from "./workspaceData";

// Minimal GeoJSON fixtures — just enough for the loader to build an
// asset array. The test is specifically about feedstock enrichment; it
// is NOT trying to exercise the full refinery type contract.

const refineryCollection = {
  type: "FeatureCollection",
  _metadata: {
    source: "test",
    downloadDate: "2026-04-15",
    recordCount: 2
  },
  features: [
    {
      type: "Feature",
      id: "refinery-ir-abadan-refinery",
      geometry: { type: "Point", coordinates: [48.3, 30.35] },
      properties: {
        id: "refinery-ir-abadan-refinery",
        name: "Abadan Refinery",
        country: "IR",
        countryName: "Iran",
        owner: "NIOC",
        operator: "NIOC",
        status: "operational",
        capacity_bpd: 400000,
        capacityUnit: "bpd",
        lat: 30.35,
        lon: 48.3
      }
    },
    {
      type: "Feature",
      id: "refinery-nonexistent",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        id: "refinery-nonexistent",
        name: "Uncurated Refinery",
        country: "XX",
        countryName: "Nowhere",
        owner: "Unknown",
        operator: "Unknown",
        status: "operational",
        capacity_bpd: 100000,
        capacityUnit: "bpd",
        lat: 0,
        lon: 0
      }
    }
  ]
};

const emptyGeoJson = (source: string) => ({
  type: "FeatureCollection",
  _metadata: { source, downloadDate: "2026-04-15", recordCount: 0 },
  features: []
});

const emptyCompanies = {
  _metadata: { source: "test", downloadDate: "2026-04-15", recordCount: 0 },
  companies: []
};

const emptyCountries = {
  _metadata: { source: "test", downloadDate: "2026-04-15", recordCount: 0 },
  countries: []
};

const feedstockPayload = {
  mode: "STATIC_SNAPSHOT" as const,
  asOf: "2026-04-15",
  source: "test",
  methodology: "test",
  entries: [
    {
      refineryId: "refinery-ir-abadan-refinery",
      hormuzDependency: 1.0,
      dominantGrades: ["Iranian Heavy"],
      bypassAccessible: false,
      note: "Fully Hormuz-locked."
    }
  ]
};

describe("loadMapWorkspaceData — refinery feedstock enrichment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("joins feedstock entries onto refinery assets and defaults missing IDs to undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        switch (input) {
          case "/data/infrastructure/refineries.geojson":
            return { ok: true, json: async () => refineryCollection };
          case "/data/infrastructure/pipelines.geojson":
            return { ok: true, json: async () => emptyGeoJson("pipelines") };
          case "/data/infrastructure/fields.geojson":
            return { ok: true, json: async () => emptyGeoJson("fields") };
          case "/data/infrastructure/terminals.geojson":
            return { ok: true, json: async () => emptyGeoJson("terminals") };
          case "/data/reference/chokepoints.geojson":
            return { ok: true, json: async () => emptyGeoJson("chokepoints") };
          case "/data/reference/companies.json":
            return { ok: true, json: async () => emptyCompanies };
          case "/data/reference/countries.json":
            return { ok: true, json: async () => emptyCountries };
          case "/data/reference/refinery_feedstock.json":
            return { ok: true, json: async () => feedstockPayload };
          default:
            throw new Error(`Unexpected fetch call: ${input}`);
        }
      })
    );

    const data = await loadMapWorkspaceData();

    // feedstockById is exposed on the workspace data payload
    expect(data.feedstockById["refinery-ir-abadan-refinery"]).toBeDefined();
    expect(
      data.feedstockById["refinery-ir-abadan-refinery"].hormuzDependency
    ).toBe(1.0);

    // Refinery assets carry hormuzDependency inline for Mapbox paint
    const abadan = data.assets.find(
      (asset) => asset.assetKind === "refinery" && asset.id === "refinery-ir-abadan-refinery"
    );
    expect(abadan).toBeDefined();
    if (abadan && abadan.assetKind === "refinery") {
      expect(abadan.hormuzDependency).toBe(1.0);
    }

    // Uncurated refinery — no matching feedstock entry — falls through as
    // undefined. The downstream `buildPointCollection` defaults it to 0
    // before handing to Mapbox; that's tested in scenarioMapStyles.test.ts.
    const uncurated = data.assets.find(
      (asset) => asset.assetKind === "refinery" && asset.id === "refinery-nonexistent"
    );
    expect(uncurated).toBeDefined();
    if (uncurated && uncurated.assetKind === "refinery") {
      expect(uncurated.hormuzDependency).toBeUndefined();
    }
  });
});
