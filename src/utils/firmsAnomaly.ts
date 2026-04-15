import type {
  FirmsBaselineEntry,
  FirmsFacilityAnomaly,
  FirmsGeofenceMatch,
  FirmsSeverity
} from "../types/firms";

// Pure anomaly scoring for the FIRMS pipeline. CLAUDE.md P0 #10 step 3:
// flag when the NUMBER of detections in the current window is abnormal
// relative to the facility's historical baseline — NOT fire-radiative-
// power sigma, which was the approach the old project tried and which
// proved too noisy (small samples, atmospheric variability).
//
// Design:
//   1. Aggregate matches by asset id (one anomaly row per asset).
//   2. Compare the window count to the curated baseline (mean, stdev).
//   3. Z-score = (count - mean) / stdev. When stdev is 0, fall back
//      to a simple ratio check against the mean to avoid divide-by-0
//      AND still flag "3 detections at a facility that normally has 0".
//   4. Bucket: NORMAL < elevatedZ ≤ ELEVATED < alertZ ≤ ALERT.
//
// The baseline map can be missing an asset entirely — curated data
// only covers known facilities. Missing-baseline assets fall through
// to NORMAL, which keeps them off the alert feed but still visible as
// dim dots on the map (the geofence matched, we just don't have
// history to judge it against).

export interface FirmsAnomalyThresholds {
  elevatedZ: number;
  alertZ: number;
}

export const DEFAULT_FIRMS_ANOMALY_THRESHOLDS: FirmsAnomalyThresholds = {
  elevatedZ: 2.0,
  alertZ: 3.5
};

export function scoreFacilityAnomalies(
  matches: FirmsGeofenceMatch[],
  baselineByAssetId: Map<string, FirmsBaselineEntry>,
  thresholds: FirmsAnomalyThresholds = DEFAULT_FIRMS_ANOMALY_THRESHOLDS
): FirmsFacilityAnomaly[] {
  if (matches.length === 0) {
    return [];
  }

  const byAssetId = new Map<string, FirmsGeofenceMatch[]>();
  for (const match of matches) {
    const existing = byAssetId.get(match.asset.id);
    if (existing) {
      existing.push(match);
    } else {
      byAssetId.set(match.asset.id, [match]);
    }
  }

  const anomalies: FirmsFacilityAnomaly[] = [];

  for (const [assetId, assetMatches] of byAssetId) {
    const count = assetMatches.length;
    const baseline = baselineByAssetId.get(assetId) ?? null;

    const latestDetectionAt = assetMatches
      .map((match) => match.detection.acquiredAt)
      .sort()
      .at(-1) as string;

    // No baseline → we can't judge, so default to NORMAL. The match is
    // still visible on the map; we just never escalate it on the feed.
    if (!baseline) {
      anomalies.push({
        asset: assetMatches[0].asset,
        windowCount: count,
        baselineMean: 0,
        baselineStdev: 0,
        zScore: 0,
        ratioToBaseline: 0,
        severity: "NORMAL",
        latestDetectionAt
      });
      continue;
    }

    const mean = baseline.mean;
    const stdev = baseline.stdev;
    const ratioToBaseline = mean > 0 ? count / mean : count > 0 ? Number.POSITIVE_INFINITY : 0;

    // Zero-stdev baseline: a facility whose historical detection count
    // is perfectly flat. Use a ratio rule instead of a z-score to avoid
    // divide-by-zero. 2× mean → ELEVATED, 3.5× mean → ALERT, matching
    // the default z thresholds in spirit.
    let zScore = 0;
    let severity: FirmsSeverity = "NORMAL";

    if (stdev <= 0) {
      if (count <= mean) {
        severity = "NORMAL";
      } else if (ratioToBaseline >= thresholds.alertZ) {
        severity = "ALERT";
      } else if (ratioToBaseline >= thresholds.elevatedZ) {
        severity = "ELEVATED";
      }
    } else {
      zScore = (count - mean) / stdev;
      if (zScore >= thresholds.alertZ) {
        severity = "ALERT";
      } else if (zScore >= thresholds.elevatedZ) {
        severity = "ELEVATED";
      }
    }

    anomalies.push({
      asset: assetMatches[0].asset,
      windowCount: count,
      baselineMean: mean,
      baselineStdev: stdev,
      zScore,
      ratioToBaseline,
      severity,
      latestDetectionAt
    });
  }

  // Most-severe first, then most-recent. ALERT > ELEVATED > NORMAL.
  const severityWeight: Record<FirmsSeverity, number> = {
    ALERT: 2,
    ELEVATED: 1,
    NORMAL: 0
  };

  return anomalies.sort((left, right) => {
    const weightDelta = severityWeight[right.severity] - severityWeight[left.severity];
    if (weightDelta !== 0) {
      return weightDelta;
    }
    return right.latestDetectionAt.localeCompare(left.latestDetectionAt);
  });
}
