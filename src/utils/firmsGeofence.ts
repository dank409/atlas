import type {
  FirmsDetection,
  FirmsGeofenceMatch,
  GeofenceableAsset
} from "../types/firms";

// Pure geofencing utilities for the FIRMS pipeline. CLAUDE.md P0 #10
// step 1: "only surface detections that fall inside a known
// infrastructure asset's radius". This is the single most impactful
// filter — it's what turns FIRMS from desert-fire noise into an
// actionable signal on regional oil infrastructure.
//
// Two deliberate design calls:
//
//   1. "Smallest containing radius wins" tiebreak. When two geofences
//      overlap (e.g., a 5km refinery and a 2km terminal across the
//      quay), the smaller radius is the more specific match and
//      should own the detection. Otherwise a single alert triggers
//      against the wrong asset.
//
//   2. Pipelines are skipped at the geofence stage. CLAUDE.md's notes
//      mention pipeline buffers but they require route geometry and
//      buffer math we don't have yet. A point-in-buffer test over a
//      2000km LineString is also materially more expensive than the
//      point-in-circle check used here. We punt pipelines to a
//      follow-up prompt and leave them out of the match set for now.

const EARTH_RADIUS_KM = 6371;

/**
 * For every detection, find the single best-matching geofenceable
 * asset. A detection "matches" an asset when its great-circle
 * distance to the asset centre is ≤ the asset's radius. When a
 * detection lands inside multiple geofences, the asset with the
 * smallest radius wins (most specific match).
 *
 * Returns one FirmsGeofenceMatch per matched detection. Detections
 * that land outside every geofence are silently dropped — this is
 * the core "kill the desert noise" filter.
 */
export function matchDetectionsToAssets(
  detections: FirmsDetection[],
  assets: GeofenceableAsset[]
): FirmsGeofenceMatch[] {
  const matches: FirmsGeofenceMatch[] = [];

  // Pipelines excluded per the header note. Filter once to avoid
  // paying the cost per detection.
  const pointAssets = assets.filter((asset) => asset.assetType !== "pipeline");

  for (const detection of detections) {
    let best: FirmsGeofenceMatch | null = null;

    for (const asset of pointAssets) {
      const distanceKm = haversineKm(
        detection.latitude,
        detection.longitude,
        asset.center.lat,
        asset.center.lon
      );

      if (distanceKm > asset.radiusKm) {
        continue;
      }

      if (best === null || asset.radiusKm < best.asset.radiusKm) {
        best = { detection, asset, distanceKm };
      }
    }

    if (best !== null) {
      matches.push(best);
    }
  }

  return matches;
}

/**
 * Great-circle distance in kilometres between two (lat, lon) points.
 * Pure, deterministic, no external dependency.
 *
 * Exported for tests and for any future consumer that needs a simple
 * distance calculation (e.g., "nearest refinery to a FIRMS detection").
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const h =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
