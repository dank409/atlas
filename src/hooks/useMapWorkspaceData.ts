import { useEffect, useState } from "react";
import { loadMapWorkspaceData } from "../services/workspaceData";
import type { MapWorkspaceData } from "../types/Infrastructure";

export function useMapWorkspaceData() {
  const [data, setData] = useState<MapWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isActive = true;

    async function fetchWorkspaceData() {
      try {
        const nextData = await loadMapWorkspaceData();

        if (!isActive) {
          return;
        }

        setData(nextData);
        setError(null);
      } catch (nextError) {
        if (!isActive) {
          return;
        }

        setError(nextError instanceof Error ? nextError : new Error("Failed to load workspace data"));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchWorkspaceData();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    assets: data?.assets ?? [],
    catalog: data?.catalog ?? [],
    companiesById: data?.companiesById ?? {},
    countriesByCode: data?.countriesByCode ?? {},
    exposureByTargetId: data?.exposureByTargetId ?? {},
    feedstockById: data?.feedstockById ?? {},
    firmsBaselineByAssetId: data?.firmsBaselineByAssetId ?? EMPTY_BASELINE_MAP,
    error,
    isLoading
  };
}

// Keep the empty-map reference stable across re-renders so consumers
// that `useMemo` on it don't invalidate their cache needlessly.
const EMPTY_BASELINE_MAP: Map<string, import("../types/firms").FirmsBaselineEntry> = new Map();
