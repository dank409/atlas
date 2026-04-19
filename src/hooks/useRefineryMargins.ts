import { useEffect, useState } from "react";
import { loadRefineryMarginSnapshot } from "../services/refineryMargins";
import type { RefineryMarginSnapshot } from "../types/RefineryMargins";

interface UseRefineryMarginsResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: RefineryMarginSnapshot | null;
}

export function useRefineryMargins(): UseRefineryMarginsResult {
  const [snapshot, setSnapshot] = useState<RefineryMarginSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    async function fetchSnapshot() {
      try {
        const next = await loadRefineryMarginSnapshot();
        if (!isActive) return;
        setSnapshot(next);
        setError(null);
      } catch (nextError) {
        if (!isActive) return;
        setError(
          nextError instanceof Error ? nextError : new Error("Margin load failed")
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }
    fetchSnapshot();
    return () => {
      isActive = false;
    };
  }, []);

  return { snapshot, error, isLoading };
}
