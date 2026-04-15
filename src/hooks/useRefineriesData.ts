import { useEffect, useState } from "react";
import { loadRefineries } from "../services/refineries";
import type { RefineryFeatureCollection } from "../types/Refinery";

export function useRefineriesData() {
  const [collection, setCollection] = useState<RefineryFeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isActive = true;

    async function fetchRefineries() {
      try {
        const nextCollection = await loadRefineries();

        if (!isActive) {
          return;
        }

        setCollection(nextCollection);
        setError(null);
      } catch (nextError) {
        if (!isActive) {
          return;
        }

        setError(nextError instanceof Error ? nextError : new Error("Failed to load refineries"));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchRefineries();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    collection,
    error,
    isLoading
  };
}
