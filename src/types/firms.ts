// NASA FIRMS (Fire Information for Resource Management System) types.
// CLAUDE.md P0 #10 and the "FIRMS Implementation Notes" section.
//
// FIRMS ships satellite-borne thermal anomaly detections from VIIRS
// (primary, 375m resolution, ~6h latency) and MODIS (legacy, 1km
// resolution). For Middle East oil infrastructure monitoring we default
// to VIIRS — faster refresh, higher spatial fidelity, and the direct
// successor to MODIS. MODIS support is present but not primary.
//
// A raw FIRMS detection is just a pixel that crossed the thermal
// threshold. The analytical value is in the downstream transforms:
//
//   1. Geofence filter — only show detections within a known asset
//      radius so desert scrub fires don't flood the map (`FirmsGeofenceMatch`).
//   2. Historical baseline comparison — a refinery that averages 1
//      detection per 72h and suddenly shows 12 is a real signal; a
//      gas flare that averages 4 and shows 5 is not (`FirmsFacilityAnomaly`).
//
// The `FirmsSnapshot` wraps all three stages so consumers get a single
// immutable result to render against.

export interface FirmsDetection {
  /** Stable composite: `${lat}|${lon}|${acqDate}|${acqTime}|${satellite}`. */
  id: string;
  latitude: number;
  longitude: number;
  /** ISO 8601 UTC (combines acq_date + acq_time from the CSV). */
  acquiredAt: string;
  satellite: "VIIRS_SNPP" | "VIIRS_NOAA20" | "MODIS_AQUA" | "MODIS_TERRA";
  /** Raw value from the CSV (string for VIIRS, number for MODIS). */
  confidenceRaw: string | number;
  /** Normalised 0-100 score. See `normalizeConfidence` in firms.ts. */
  confidenceScore: number;
  /** Fire radiative power in MW. */
  frp: number;
  dayNight: "D" | "N";
  /** Brightness temperature (bright_ti4 for VIIRS, bright_t31 for MODIS). */
  brightness: number;
}

export interface GeofenceableAsset {
  id: string;
  name: string;
  assetType: "refinery" | "terminal" | "pipeline" | "field";
  center: { lat: number; lon: number };
  radiusKm: number;
  owner?: string;
  operator?: string;
  capacityBpd?: number;
}

export interface FirmsGeofenceMatch {
  detection: FirmsDetection;
  asset: GeofenceableAsset;
  /** Great-circle distance from detection to asset center. */
  distanceKm: number;
}

export type FirmsSeverity = "NORMAL" | "ELEVATED" | "ALERT";

export interface FirmsBaselineEntry {
  mean: number;
  stdev: number;
  /** Rolling window the baseline was fit against. */
  period: "30d" | "90d";
}

export interface FirmsFacilityAnomaly {
  asset: GeofenceableAsset;
  windowCount: number;
  baselineMean: number;
  baselineStdev: number;
  /** (count - mean) / stdev; 0 when stdev is 0. */
  zScore: number;
  /** Ratio of current count to baseline mean, used in the alert feed string. */
  ratioToBaseline: number;
  severity: FirmsSeverity;
  latestDetectionAt: string;
}

export type FirmsWindowHours = 24 | 72 | 168;

export interface FirmsSnapshot {
  mode: "LIVE" | "STATIC_SNAPSHOT";
  asOf: string;
  windowHours: FirmsWindowHours;
  confidenceThreshold: number;
  detections: FirmsDetection[];
  matches: FirmsGeofenceMatch[];
  anomalies: FirmsFacilityAnomaly[];
  source: string;
}
