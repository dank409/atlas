import { describe, expect, it } from "vitest";
import {
  buildBrentTimespreadSnapshot,
  buildBrentWtiSpreadHistory,
  buildCrudeMarketSummary,
  formatChange,
  formatChangePct,
  formatDataStamp,
  formatPrice,
  formatSpread
} from "./marketSummary";
import type {
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot
} from "../types/Market";
import type { IceBrentSettlementSnapshot } from "../types/IceSettlements";

const baseSnapshot: CrudePriceSnapshot = {
  asOf: "2026-04-14",
  cadence: "EOD",
  classification: "OBSERVED",
  source: "EIA v2 petroleum/pri/spt (static snapshot)",
  series: {
    brent: [
      { date: "2026-04-10", value: 76.8 },
      { date: "2026-04-11", value: 77.1 },
      { date: "2026-04-14", value: 77.35 }
    ],
    wti: [
      { date: "2026-04-10", value: 72.9 },
      { date: "2026-04-11", value: 73.1 },
      { date: "2026-04-14", value: 73.42 }
    ]
  }
};

const baseDmeOman: DmeOmanSnapshot = {
  asOf: "2026-04-14",
  cadence: "CURATED",
  classification: "CURATED",
  source: "DME",
  series: {
    dmeOman: [
      { date: "2026-04-10", value: 75.9 },
      { date: "2026-04-11", value: 76.1 },
      { date: "2026-04-14", value: 76.31 }
    ]
  }
};

const baseMurban: MurbanSnapshot = {
  asOf: "2026-04-14",
  cadence: "CURATED",
  classification: "CURATED",
  source: "IFAD",
  series: {
    murban: [
      { date: "2026-04-10", value: 76.7 },
      { date: "2026-04-11", value: 76.95 },
      { date: "2026-04-14", value: 77.07 }
    ]
  }
};

describe("buildCrudeMarketSummary", () => {
  it("computes latest quotes, day-over-day change, and spread — legacy Brent+WTI only call", () => {
    const summary = buildCrudeMarketSummary(baseSnapshot);

    expect(summary).not.toBeNull();
    expect(summary?.brent.value).toBe(77.35);
    expect(summary?.brent.change).toBe(0.25);
    expect(summary?.brent.changePct).toBeCloseTo(0.32, 2);
    expect(summary?.wti.value).toBe(73.42);
    expect(summary?.wti.change).toBe(0.32);
    expect(summary?.brentWtiSpread).toBe(3.93);
    expect(summary?.cadence).toBe("EOD");
    expect(summary?.classification).toBe("OBSERVED");
    // Gulf fields undefined when only the legacy snapshot is passed.
    expect(summary?.dmeOman).toBeUndefined();
    expect(summary?.murban).toBeUndefined();
    expect(summary?.brentDmeOmanSpread).toBeUndefined();
  });

  it("folds in DME Oman and Murban quotes when the Gulf snapshots are provided", () => {
    const summary = buildCrudeMarketSummary({
      crude: baseSnapshot,
      dmeOman: baseDmeOman,
      murban: baseMurban
    });

    expect(summary?.dmeOman?.value).toBe(76.31);
    expect(summary?.dmeOman?.name).toBe("DME_OMAN");
    expect(summary?.murban?.value).toBe(77.07);
    expect(summary?.murban?.name).toBe("MURBAN");
    // Brent minus DME Oman: 77.35 - 76.31 = 1.04 — positive means Oman discount.
    expect(summary?.brentDmeOmanSpread).toBe(1.04);
  });

  it("leaves brentDmeOmanSpread undefined when DME Oman is absent but Murban is present", () => {
    const summary = buildCrudeMarketSummary({
      crude: baseSnapshot,
      dmeOman: null,
      murban: baseMurban
    });

    expect(summary?.dmeOman).toBeUndefined();
    expect(summary?.murban?.value).toBe(77.07);
    expect(summary?.brentDmeOmanSpread).toBeUndefined();
  });

  it("returns null when either hard-required benchmark series (Brent/WTI) is empty", () => {
    const snapshot: CrudePriceSnapshot = {
      ...baseSnapshot,
      series: { brent: [], wti: baseSnapshot.series.wti }
    };

    expect(buildCrudeMarketSummary(snapshot)).toBeNull();
  });

  it("handles single-point series with zero change", () => {
    const snapshot: CrudePriceSnapshot = {
      ...baseSnapshot,
      series: {
        brent: [{ date: "2026-04-14", value: 77.35 }],
        wti: [{ date: "2026-04-14", value: 73.42 }]
      }
    };

    const summary = buildCrudeMarketSummary(snapshot);
    expect(summary?.brent.change).toBe(0);
    expect(summary?.brent.changePct).toBe(0);
  });
});

describe("macro derivations", () => {
  it("builds Brent-WTI spread history from aligned dates only", () => {
    const spreadHistory = buildBrentWtiSpreadHistory({
      ...baseSnapshot,
      series: {
        brent: [
          { date: "2026-04-10", value: 76.8 },
          { date: "2026-04-11", value: 77.1 },
          { date: "2026-04-14", value: 77.35 }
        ],
        wti: [
          { date: "2026-04-10", value: 72.9 },
          { date: "2026-04-14", value: 73.42 },
          { date: "2026-04-15", value: 73.55 }
        ]
      }
    });

    expect(spreadHistory.series.brentWti).toEqual([
      { date: "2026-04-10", value: 3.9 },
      { date: "2026-04-14", value: 3.93 }
    ]);
    expect(spreadHistory.cadence).toBe("EOD");
    expect(spreadHistory.classification).toBe("OBSERVED");
  });

  it("builds prompt Brent timespreads from the ICE strip", () => {
    const snapshot: IceBrentSettlementSnapshot = {
      asOf: "2026-04-14",
      cadence: "CURATED",
      classification: "CURATED",
      source: "ICE Brent settlements",
      strip: [
        { month: 1, contractCode: "BRN M1", priceUsd: 77.35 },
        { month: 2, contractCode: "BRN M2", priceUsd: 75.8 },
        { month: 6, contractCode: "BRN M6", priceUsd: 71.15 },
        { month: 12, contractCode: "BRN M12", priceUsd: 67.1 }
      ]
    };

    expect(buildBrentTimespreadSnapshot(snapshot)).toEqual({
      asOf: "2026-04-14",
      cadence: "CURATED",
      classification: "CURATED",
      source: "ICE Brent settlements",
      m1MinusM2: 1.55,
      m1MinusM6: 6.2,
      m1MinusM12: 10.25,
      structure: "BACKWARDATION"
    });
  });

  it("returns null when the ICE strip is missing required prompt months", () => {
    const incompleteSnapshot: IceBrentSettlementSnapshot = {
      asOf: "2026-04-14",
      cadence: "CURATED",
      classification: "CURATED",
      source: "ICE Brent settlements",
      strip: [{ month: 1, contractCode: "BRN M1", priceUsd: 77.35 }]
    };

    expect(buildBrentTimespreadSnapshot(incompleteSnapshot)).toBeNull();
  });
});

describe("market formatters", () => {
  it("formats prices with a dollar prefix and two decimals", () => {
    expect(formatPrice(77.3)).toBe("$77.30");
  });

  it("prefixes positive changes with a plus sign, negatives unchanged", () => {
    expect(formatChange(1.25)).toBe("+1.25");
    expect(formatChange(-0.5)).toBe("-0.50");
    expect(formatChange(0)).toBe("0.00");
  });

  it("formats percent change with trailing percent sign", () => {
    expect(formatChangePct(0.32)).toBe("+0.32%");
    expect(formatChangePct(-1.1)).toBe("-1.10%");
  });

  it("formats spread with sign", () => {
    expect(formatSpread(-3.93)).toBe("-3.93");
    expect(formatSpread(0.75)).toBe("+0.75");
  });

  it("formats provenance stamps with typed cadence and classification", () => {
    expect(
      formatDataStamp({
        asOf: "2026-04-14",
        cadence: "EOD",
        classification: "OBSERVED",
        source: "EIA"
      })
    ).toBe("OBSERVED | EOD | EIA | 2026-04-14");
  });
});
