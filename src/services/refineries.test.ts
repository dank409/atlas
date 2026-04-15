import { loadRefineries } from "./refineries";

const refineryCollection = {
  type: "FeatureCollection",
  _metadata: {
    source: "Approved spec bootstrap dataset",
    downloadDate: "2026-04-13",
    recordCount: 1
  },
  features: []
};

describe("loadRefineries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the runtime refinery collection from the canonical data path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => refineryCollection
      }))
    );

    const result = await loadRefineries();

    expect(fetch).toHaveBeenCalledWith("/data/infrastructure/refineries.geojson");
    expect(result).toEqual(refineryCollection);
  });
});
