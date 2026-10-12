import { useEffect, useState } from "react";
import { loadMapWorkspaceData } from "../services/workspaceData";
import type { MapWorkspaceData } from "../types/Infrastructure";

const EMPTY_WORKSPACE_DATA: MapWorkspaceData = {
  assets: [],
  catalog: [],
  companies: [],
  countryProfiles: [],
  operatorAliases: []
};

export function useMapWorkspaceData() {
  const [data, setData] = useState<MapWorkspaceData>(EMPTY_WORKSPACE_DATA);
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

  return { ...data, error, isLoading };
}
