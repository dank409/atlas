import { loadMurbanSnapshot } from "./murban";

const healthyPayload = {
  asOf: "2026-04-14",
  cadence: "CURATED" as const,
  classification: "CURATED" as const,
  source: "IFAD test snapshot",
  series: {
    murban: [
      { date: "2026-04-13", value: 76.88 },
      { date: "2026-04-14", value: 77.07 }
    ]
  }
};

describe("loadMurbanSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the Murban snapshot from the canonical path and marks it CURATED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/market/murban_30d.json") {
          return { ok: true, json: async () => healthyPayload };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadMurbanSnapshot();

    expect(snapshot.cadence).toBe("CURATED");
    expect(snapshot.classification).toBe("CURATED");
    expect(snapshot.series.murban).toHaveLength(2);
    expect(snapshot.source).toBe("IFAD test snapshot");
  });

  it("drops rows with non-finite values and throws when nothing remains", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...healthyPayload,
          series: {
            murban: [
              { date: "2026-04-14", value: Number.NaN },
              { date: "2026-04-13", value: undefined }
            ]
          }
        })
      }))
    );

    await expect(loadMurbanSnapshot()).rejects.toThrow(/empty/);
  });

  it("propagates fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    await expect(loadMurbanSnapshot()).rejects.toThrow(/404/);
  });
});
