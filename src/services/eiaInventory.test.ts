import {
  buildInventoryLatestSummary,
  loadEiaWeeklyInventorySnapshot,
  normaliseInventorySeries
} from "./eiaInventory";

describe("normaliseInventorySeries", () => {
  it("drops rows with bad or null values and sorts ascending by date", () => {
    const series = normaliseInventorySeries([
      {
        date: "2026-04-15",
        value: 421.8,
        fiveYearAverage: 421.5,
        fiveYearMin: 394.2,
        fiveYearMax: 432.7
      },
      {
        date: "2026-04-08",
        value: Number.NaN,
        fiveYearAverage: 422.2,
        fiveYearMin: 394.8,
        fiveYearMax: 434.1
      },
      {
        date: "2026-04-01",
        value: 425.9,
        fiveYearAverage: 423.1,
        fiveYearMin: 395.4,
        fiveYearMax: 435.8
      },
      {
        date: "",
        value: 430,
        fiveYearAverage: 425,
        fiveYearMin: 400,
        fiveYearMax: 440
      }
    ]);

    expect(series).toEqual([
      {
        date: "2026-04-01",
        value: 425.9,
        fiveYearAverage: 423.1,
        fiveYearMin: 395.4,
        fiveYearMax: 435.8
      },
      {
        date: "2026-04-15",
        value: 421.8,
        fiveYearAverage: 421.5,
        fiveYearMin: 394.2,
        fiveYearMax: 432.7
      }
    ]);
  });
});

describe("loadEiaWeeklyInventorySnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the weekly inventory snapshot and forces WEEKLY observed provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/market/eia_us_crude_inventories_5y.json") {
          return {
            ok: true,
            json: async () => ({
              asOf: "2026-04-15",
              source: "EIA",
              seriesName: "US Commercial Crude Excluding SPR",
              units: "million_barrels",
              series: [
                {
                  date: "2026-04-08",
                  value: 423.6,
                  fiveYearAverage: 422.2,
                  fiveYearMin: 394.8,
                  fiveYearMax: 434.1
                },
                {
                  date: "2026-04-15",
                  value: 421.8,
                  fiveYearAverage: 421.5,
                  fiveYearMin: 394.2,
                  fiveYearMax: 432.7
                }
              ]
            })
          };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadEiaWeeklyInventorySnapshot();

    expect(snapshot.cadence).toBe("WEEKLY");
    expect(snapshot.classification).toBe("OBSERVED");
    expect(snapshot.series).toHaveLength(2);
    expect(snapshot.seriesName).toContain("US Commercial Crude");
    expect(snapshot.latest).toEqual({
      date: "2026-04-15",
      value: 421.8,
      fiveYearAverage: 421.5,
      fiveYearMin: 394.2,
      fiveYearMax: 432.7,
      deltaVsAverage: 0.3,
      deltaPctVsAverage: 0.07,
      rangePosition: 0.717,
      rangePositionLabel: "WITHIN_RANGE"
    });
  });

  it("throws when the snapshot is empty after sanitisation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          asOf: "2026-04-15",
          source: "EIA",
          series: [
            {
              date: "2026-04-15",
              value: null,
              fiveYearAverage: 421.5,
              fiveYearMin: 394.2,
              fiveYearMax: 432.7
            }
          ]
        })
      }))
    );

    await expect(loadEiaWeeklyInventorySnapshot()).rejects.toThrow(/empty/);
  });
});

describe("buildInventoryLatestSummary", () => {
  it("classifies an in-range point and computes delta fields", () => {
    expect(
      buildInventoryLatestSummary({
        date: "2026-04-15",
        value: 421.8,
        fiveYearAverage: 421.5,
        fiveYearMin: 394.2,
        fiveYearMax: 432.7
      })
    ).toEqual({
      date: "2026-04-15",
      value: 421.8,
      fiveYearAverage: 421.5,
      fiveYearMin: 394.2,
      fiveYearMax: 432.7,
      deltaVsAverage: 0.3,
      deltaPctVsAverage: 0.07,
      rangePosition: 0.717,
      rangePositionLabel: "WITHIN_RANGE"
    });
  });

  it("clamps below-range and above-range positions while preserving the label", () => {
    expect(
      buildInventoryLatestSummary({
        date: "2026-04-15",
        value: 390,
        fiveYearAverage: 421.5,
        fiveYearMin: 394.2,
        fiveYearMax: 432.7
      }).rangePositionLabel
    ).toBe("BELOW_RANGE");
    expect(
      buildInventoryLatestSummary({
        date: "2026-04-15",
        value: 440,
        fiveYearAverage: 421.5,
        fiveYearMin: 394.2,
        fiveYearMax: 432.7
      }).rangePositionLabel
    ).toBe("ABOVE_RANGE");
  });
});
