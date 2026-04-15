import { haversineKm, matchDetectionsToAssets } from "./firmsGeofence";
import type { FirmsDetection, GeofenceableAsset } from "../types/firms";

function makeDetection(
  overrides: Partial<FirmsDetection> & { latitude: number; longitude: number }
): FirmsDetection {
  return {
    id: `${overrides.latitude}|${overrides.longitude}|detect`,
    acquiredAt: "2026-04-14T10:00:00Z",
    satellite: "VIIRS_SNPP",
    confidenceRaw: "high",
    confidenceScore: 95,
    frp: 12,
    dayNight: "D",
    brightness: 330,
    ...overrides
  };
}

const ruwais: GeofenceableAsset = {
  id: "refinery-ruwais",
  name: "Ruwais Refinery",
  assetType: "refinery",
  center: { lat: 24.1108, lon: 54.0894 },
  radiusKm: 5,
  capacityBpd: 837000
};

const abadan: GeofenceableAsset = {
  id: "refinery-ir-abadan-refinery",
  name: "Abadan Refinery",
  assetType: "refinery",
  center: { lat: 30.3392, lon: 48.3043 },
  radiusKm: 5
};

const ruwaisTerminal: GeofenceableAsset = {
  id: "terminal-ruwais",
  name: "Ruwais Terminal",
  assetType: "terminal",
  center: { lat: 24.1108, lon: 54.0894 },
  radiusKm: 2
};

const basraPipeline: GeofenceableAsset = {
  id: "pipeline-basra-fake",
  name: "Basra pipeline",
  assetType: "pipeline",
  center: { lat: 30.5, lon: 47.8 },
  radiusKm: 5
};

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineKm(25, 50, 25, 50)).toBe(0);
  });

  it("computes a ~111km distance for 1 degree of latitude", () => {
    const distance = haversineKm(25, 50, 26, 50);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("computes ~100km for a ~1° longitude step near 24°N", () => {
    const distance = haversineKm(24, 54, 24, 55);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(102);
  });
});

describe("matchDetectionsToAssets", () => {
  it("matches a detection inside a refinery geofence", () => {
    const detections: FirmsDetection[] = [
      makeDetection({ latitude: 24.115, longitude: 54.092 })
    ];

    const matches = matchDetectionsToAssets(detections, [ruwais]);

    expect(matches).toHaveLength(1);
    expect(matches[0].asset.id).toBe("refinery-ruwais");
    expect(matches[0].distanceKm).toBeLessThan(5);
  });

  it("excludes detections that fall outside every geofence", () => {
    const detections: FirmsDetection[] = [
      // ~60km off Ruwais in the desert.
      makeDetection({ latitude: 24.6, longitude: 54.5 })
    ];

    const matches = matchDetectionsToAssets(detections, [ruwais, abadan]);

    expect(matches).toHaveLength(0);
  });

  it("picks the smallest-radius asset when geofences overlap", () => {
    // Ruwais refinery (5km) and Ruwais terminal (2km) share a centre.
    // A detection on the shared point should land on the terminal.
    const detections: FirmsDetection[] = [
      makeDetection({ latitude: 24.111, longitude: 54.09 })
    ];

    const matches = matchDetectionsToAssets(detections, [ruwais, ruwaisTerminal]);

    expect(matches).toHaveLength(1);
    expect(matches[0].asset.id).toBe("terminal-ruwais");
  });

  it("ignores pipeline assets (pipelines are punted to a follow-up)", () => {
    const detections: FirmsDetection[] = [
      makeDetection({ latitude: 30.5, longitude: 47.8 })
    ];

    const matches = matchDetectionsToAssets(detections, [basraPipeline]);

    expect(matches).toHaveLength(0);
  });

  it("keeps multiple detections on the same asset and drops unmatched ones", () => {
    const detections: FirmsDetection[] = [
      makeDetection({ latitude: 24.111, longitude: 54.09 }),
      makeDetection({ latitude: 24.113, longitude: 54.095 }),
      // Far away — dropped.
      makeDetection({ latitude: 25.5, longitude: 55.5 })
    ];

    const matches = matchDetectionsToAssets(detections, [ruwais]);

    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.asset.id === "refinery-ruwais")).toBe(true);
  });
});
