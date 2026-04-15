import { useEffect, useMemo, useState } from "react";
import { loadFirmsDetections } from "../services/firms";
import { matchDetectionsToAssets } from "../utils/firmsGeofence";
import { scoreFacilityAnomalies } from "../utils/firmsAnomaly";
import type {
  FirmsBaselineEntry,
  FirmsSnapshot,
  FirmsWindowHours,
  GeofenceableAsset
} from "../types/firms";
import type { InfrastructureAsset } from "../types/Infrastructure";

interface UseFirmsArgs {
  assets: InfrastructureAsset[];
  baselineByAssetId: Map<string, FirmsBaselineEntry>;
  windowHours: FirmsWindowHours;
  confidenceThreshold: number;
  enabled: boolean;
}

interface UseFirmsResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: FirmsSnapshot | null;
}

/**
 * Orchestrator hook that threads the FIRMS pipeline:
 *
 *   load detections  (service: live → static fallback)
 *   → geofence to assets  (pure util)
 *   → score anomalies vs. baselines  (pure util)
 *   → wrap in FirmsSnapshot for consumers
 *
 * Assets + baselines come from the workspace-data hydrator so the hook
 * re-runs the pipeline whenever the underlying data changes. Detection
 * fetch only re-runs when `windowHours` / `confidenceThreshold` / the
 * `enabled` flag flip.
 */
export function useFirms({
  assets,
  baselineByAssetId,
  windowHours,
  confidenceThreshold,
  enabled
}: UseFirmsArgs): UseFirmsResult {
  const [rawSnapshot, setRawSnapshot] = useState<
    Omit<FirmsSnapshot, "matches" | "anomalies"> | null
  >(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setRawSnapshot(null);
      setIsLoading(false);
      return () => {};
    }

    let isActive = true;
    setIsLoading(true);

    async function fetchDetections() {
      try {
        const next = await loadFirmsDetections({
          windowHours,
          confidenceThreshold
        });

        if (!isActive) {
          return;
        }

        setRawSnapshot(next);
        setError(null);
      } catch (nextError) {
        if (!isActive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Failed to load FIRMS snapshot")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchDetections();

    return () => {
      isActive = false;
    };
  }, [windowHours, confidenceThreshold, enabled]);

  // Geofence + anomaly is cheap enough to rebuild whenever any of the
  // inputs change. Memoise on the actual dependencies rather than on
  // reference identity so a stale asset array doesn't poison downstream.
  const snapshot = useMemo<FirmsSnapshot | null>(() => {
    if (!rawSnapshot) {
      return null;
    }

    const geofenceableAssets = buildGeofenceableAssets(assets);
    const matches = matchDetectionsToAssets(rawSnapshot.detections, geofenceableAssets);
    const anomalies = scoreFacilityAnomalies(matches, baselineByAssetId);

    return {
      ...rawSnapshot,
      matches,
      anomalies
    };
  }, [rawSnapshot, assets, baselineByAssetId]);

  return {
    error,
    isLoading,
    snapshot
  };
}

/**
 * Derive the minimal `GeofenceableAsset` set from the full workspace
 * asset array. Only refineries, terminals, and fields survive — pipelines
 * are excluded by the geofence util anyway, and chokepoints are logical
 * markers not physical facilities.
 *
 * Radius source of truth: `firmsRadius_km` when present (refineries
 * currently carry it), otherwise a conservative default per asset kind.
 */
function buildGeofenceableAssets(
  assets: InfrastructureAsset[]
): GeofenceableAsset[] {
  const out: GeofenceableAsset[] = [];

  for (const asset of assets) {
    if (asset.assetKind === "refinery") {
      out.push({
        id: asset.id,
        name: asset.name,
        assetType: "refinery",
        center: { lat: asset.lat, lon: asset.lon },
        radiusKm: asset.firmsRadius_km ?? 5,
        owner: asset.owner,
        operator: asset.operator,
        capacityBpd: asset.capacity_bpd
      });
      continue;
    }

    if (asset.assetKind === "terminal") {
      out.push({
        id: asset.id,
        name: asset.name,
        assetType: "terminal",
        center: { lat: asset.lat, lon: asset.lon },
        radiusKm: 2,
        owner: asset.owner,
        operator: asset.operator,
        capacityBpd: asset.capacity_bpd
      });
      continue;
    }

    if (asset.assetKind === "field") {
      out.push({
        id: asset.id,
        name: asset.name,
        assetType: "field",
        center: { lat: asset.lat, lon: asset.lon },
        radiusKm: 4,
        operator: asset.operator
      });
    }
  }

  return out;
}
