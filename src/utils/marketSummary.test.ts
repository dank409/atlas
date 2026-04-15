import { describe, expect, it } from "vitest";
import {
  buildCrudeMarketSummary,
  formatChange,
  formatChangePct,
  formatPrice,
  formatSpread
} from "./marketSummary";
import type {
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot
} from "../types/Market";

const baseSnapshot: CrudePriceSnapshot = {
  asOf: "2026-04-14",
  mode: "STATIC_SNAPSHOT",
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
  mode: "STATIC_SNAPSHOT",
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
  mode: "STATIC_SNAPSHOT",
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
    expect(summary?.spread).toBe(-3.93);
    expect(summary?.mode).toBe("STATIC_SNAPSHOT");
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
});
