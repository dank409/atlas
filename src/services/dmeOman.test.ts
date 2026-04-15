import { loadDmeOmanSnapshot } from "./dmeOman";

const healthyPayload = {
  mode: "STATIC_SNAPSHOT",
  asOf: "2026-04-14",
  source: "DME test snapshot",
  series: {
    dmeOman: [
      { date: "2026-04-13", value: 75.89 },
      { date: "2026-04-14", value: 76.31 },
      { date: "2026-04-10", value: 76.04 }
    ]
  }
};

describe("loadDmeOmanSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the DME Oman snapshot from the canonical path and forces STATIC_SNAPSHOT mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/market/dme_oman_30d.json") {
          return { ok: true, json: async () => healthyPayload };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadDmeOmanSnapshot();

    expect(snapshot.mode).toBe("STATIC_SNAPSHOT");
    expect(snapshot.series.dmeOman).toHaveLength(3);
    expect(snapshot.source).toBe("DME test snapshot");
  });

  it("sorts the series ascending by date regardless of input order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => healthyPayload }))
    );

    const snapshot = await loadDmeOmanSnapshot();
    const dates = snapshot.series.dmeOman.map((point) => point.date);
    expect(dates).toEqual(["2026-04-10", "2026-04-13", "2026-04-14"]);
  });

  it("drops rows with non-finite values or empty dates", async () => {
    const corrupt = {
      ...healthyPayload,
      series: {
        dmeOman: [
          { date: "2026-04-14", value: 76.31 },
          { date: "2026-04-13", value: Number.NaN },
          { date: "", value: 75.5 },
          { date: "2026-04-12", value: 76.04 }
        ]
      }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => corrupt }))
    );

    const snapshot = await loadDmeOmanSnapshot();
    expect(snapshot.series.dmeOman).toHaveLength(2);
    expect(snapshot.series.dmeOman.map((p) => p.date)).toEqual([
      "2026-04-12",
      "2026-04-14"
    ]);
  });

  it("throws when the snapshot is empty after sanitisation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...healthyPayload, series: { dmeOman: [] } })
      }))
    );

    await expect(loadDmeOmanSnapshot()).rejects.toThrow(/empty/);
  });

  it("propagates fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );

    await expect(loadDmeOmanSnapshot()).rejects.toThrow(/503/);
  });
});
