import { loadCrudePriceSnapshot } from "./eiaPrices";

// Regression: EIA v2 occasionally returns { period, value: null } for the
// newest unpublished day. The previous implementation coerced null → "0" →
// 0, which passed Number.isFinite and poisoned the latest-price selector as
// $0.00 on the market tape. These tests mock the live EIA endpoint and
// assert that null / undefined / non-numeric strings are dropped, while
// legitimate numeric values (including stringified numbers) survive.

describe("loadCrudePriceSnapshot — live EIA value sanitisation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("drops null / undefined / non-numeric EIA rows instead of coercing them to zero", async () => {
    vi.stubEnv("VITE_EIA_API_KEY", "test-key");

    const brentPayload = {
      response: {
        data: [
          { period: "2026-04-13", value: 82.5 },
          { period: "2026-04-14", value: null },
          { period: "2026-04-12", value: undefined },
          { period: "2026-04-11", value: "80.1" },
          { period: "2026-04-10", value: "n/a" }
        ]
      }
    };

    const wtiPayload = {
      response: {
        data: [{ period: "2026-04-13", value: 78.0 }]
      }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("EPCBRENT")) {
          return { ok: true, json: async () => brentPayload };
        }
        if (input.includes("EPCWTI")) {
          return { ok: true, json: async () => wtiPayload };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadCrudePriceSnapshot();

    expect(snapshot.cadence).toBe("EOD");
    expect(snapshot.classification).toBe("OBSERVED");
    expect(snapshot.series.brent).toEqual([
      { date: "2026-04-11", value: 80.1 },
      { date: "2026-04-13", value: 82.5 }
    ]);

    // No poisoned zero rows, and no non-numeric carriers survived.
    const brentValues = snapshot.series.brent.map((point) => point.value);
    expect(brentValues).not.toContain(0);
    expect(brentValues.every(Number.isFinite)).toBe(true);

    // Ordering contract: ascending by date.
    const brentDates = snapshot.series.brent.map((point) => point.date);
    expect(brentDates).toEqual([...brentDates].sort());
  });

  it("preserves a legitimate numeric zero if EIA ever returns one", async () => {
    vi.stubEnv("VITE_EIA_API_KEY", "test-key");

    const brentPayload = {
      response: {
        data: [
          { period: "2026-04-13", value: 82.5 },
          { period: "2026-04-12", value: 0 }
        ]
      }
    };

    const wtiPayload = {
      response: {
        data: [{ period: "2026-04-13", value: 78.0 }]
      }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("EPCBRENT")) {
          return { ok: true, json: async () => brentPayload };
        }
        if (input.includes("EPCWTI")) {
          return { ok: true, json: async () => wtiPayload };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadCrudePriceSnapshot();

    expect(snapshot.series.brent).toEqual([
      { date: "2026-04-12", value: 0 },
      { date: "2026-04-13", value: 82.5 }
    ]);
  });
});
