import {
  DEFAULT_FIRMS_ANOMALY_THRESHOLDS,
  scoreFacilityAnomalies
} from "./firmsAnomaly";
import type {
  FirmsBaselineEntry,
  FirmsDetection,
  FirmsGeofenceMatch,
  GeofenceableAsset
} from "../types/firms";

const asset: GeofenceableAsset = {
  id: "refinery-ruwais",
  name: "Ruwais Refinery",
  assetType: "refinery",
  center: { lat: 24.1108, lon: 54.0894 },
  radiusKm: 5,
  owner: "ADNOC",
  capacityBpd: 837000
};

function makeMatch(
  offset: number,
  assetOverride: GeofenceableAsset = asset
): FirmsGeofenceMatch {
  const detection: FirmsDetection = {
    id: `det-${assetOverride.id}-${offset}`,
    latitude: assetOverride.center.lat + offset * 0.001,
    longitude: assetOverride.center.lon + offset * 0.001,
    acquiredAt: `2026-04-14T1${offset % 10}:00:00Z`,
    satellite: "VIIRS_SNPP",
    confidenceRaw: "high",
    confidenceScore: 95,
    frp: 12,
    dayNight: "D",
    brightness: 330
  };
  return { detection, asset: assetOverride, distanceKm: 0.1 };
}

describe("scoreFacilityAnomalies", () => {
  it("returns an empty list when no matches exist", () => {
    const baseline = new Map<string, FirmsBaselineEntry>();
    expect(scoreFacilityAnomalies([], baseline)).toEqual([]);
  });

  it("buckets a quiet facility as NORMAL", () => {
    const matches = [makeMatch(0)];
    const baseline = new Map<string, FirmsBaselineEntry>([
      [asset.id, { mean: 1.0, stdev: 1.0, period: "30d" }]
    ]);
    const anomalies = scoreFacilityAnomalies(matches, baseline);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].severity).toBe("NORMAL");
    expect(anomalies[0].windowCount).toBe(1);
  });

  it("buckets a 2σ excursion as ELEVATED", () => {
    const matches = Array.from({ length: 6 }, (_, index) => makeMatch(index));
    const baseline = new Map<string, FirmsBaselineEntry>([
      [asset.id, { mean: 2.0, stdev: 2.0, period: "30d" }]
    ]);
    const anomalies = scoreFacilityAnomalies(matches, baseline);
    // z = (6 - 2) / 2 = 2.0 exactly, which is the ELEVATED floor.
    expect(anomalies[0].severity).toBe("ELEVATED");
    expect(anomalies[0].zScore).toBeCloseTo(2.0, 6);
  });

  it("buckets a ≥3.5σ excursion as ALERT", () => {
    const matches = Array.from({ length: 12 }, (_, index) => makeMatch(index));
    const baseline = new Map<string, FirmsBaselineEntry>([
      [asset.id, { mean: 1.0, stdev: 2.0, period: "30d" }]
    ]);
    const anomalies = scoreFacilityAnomalies(matches, baseline);
    // z = (12 - 1) / 2 = 5.5 — clearly above alertZ.
    expect(anomalies[0].severity).toBe("ALERT");
    expect(anomalies[0].zScore).toBeCloseTo(5.5, 6);
  });

  it("falls through to NORMAL for assets with no baseline", () => {
    const matches = Array.from({ length: 20 }, (_, index) => makeMatch(index));
    const baseline = new Map<string, FirmsBaselineEntry>();
    const anomalies = scoreFacilityAnomalies(matches, baseline);
    expect(anomalies[0].severity).toBe("NORMAL");
    expect(anomalies[0].windowCount).toBe(20);
    expect(anomalies[0].baselineMean).toBe(0);
  });

  it("handles a zero-stdev baseline with a ratio rule (no divide-by-zero)", () => {
    const matches = Array.from({ length: 8 }, (_, index) => makeMatch(index));
    const baseline = new Map<string, FirmsBaselineEntry>([
      [asset.id, { mean: 2.0, stdev: 0, period: "30d" }]
    ]);
    const anomalies = scoreFacilityAnomalies(matches, baseline);
    // count/mean = 4 → at/above alertZ (3.5) → ALERT.
    expect(anomalies[0].severity).toBe("ALERT");
    expect(anomalies[0].ratioToBaseline).toBe(4);
  });

  it("treats a zero-stdev baseline with zero mean as ALERT when any detections appear", () => {
    const matches = [makeMatch(0), makeMatch(1), makeMatch(2), makeMatch(3)];
    const baseline = new Map<string, FirmsBaselineEntry>([
      [asset.id, { mean: 0, stdev: 0, period: "30d" }]
    ]);
    const anomalies = scoreFacilityAnomalies(matches, baseline);
    // ratio = Infinity → easily above alertZ → ALERT.
    expect(anomalies[0].severity).toBe("ALERT");
  });

  it("sorts anomalies by severity descending (ALERT > ELEVATED > NORMAL)", () => {
    const quietAsset: GeofenceableAsset = {
      ...asset,
      id: "refinery-sa-yanbu-refinery",
      name: "Yanbu Refinery"
    };
    const loudAsset: GeofenceableAsset = {
      ...asset,
      id: "refinery-sa-ras-tanura-refinery",
      name: "Ras Tanura Refinery"
    };

    const matches = [
      makeMatch(0, quietAsset),
      ...Array.from({ length: 12 }, (_, index) => makeMatch(index, loudAsset))
    ];
    const baseline = new Map<string, FirmsBaselineEntry>([
      [quietAsset.id, { mean: 1.0, stdev: 1.0, period: "30d" }],
      [loudAsset.id, { mean: 1.0, stdev: 2.0, period: "30d" }]
    ]);

    const anomalies = scoreFacilityAnomalies(matches, baseline);
    expect(anomalies.map((anomaly) => anomaly.severity)).toEqual(["ALERT", "NORMAL"]);
  });

  it("uses the configured thresholds when provided", () => {
    const matches = Array.from({ length: 4 }, (_, index) => makeMatch(index));
    const baseline = new Map<string, FirmsBaselineEntry>([
      [asset.id, { mean: 1.0, stdev: 1.0, period: "30d" }]
    ]);
    // Raise both thresholds so z=3 no longer qualifies as ELEVATED.
    const anomalies = scoreFacilityAnomalies(matches, baseline, {
      elevatedZ: 5,
      alertZ: 10
    });
    expect(anomalies[0].severity).toBe("NORMAL");
  });

  it("defaults are the documented z-thresholds", () => {
    expect(DEFAULT_FIRMS_ANOMALY_THRESHOLDS).toEqual({ elevatedZ: 2.0, alertZ: 3.5 });
  });
});
