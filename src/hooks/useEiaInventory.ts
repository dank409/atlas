import { useEffect, useState } from "react";
import { loadEiaWeeklyInventorySnapshot } from "../services/eiaInventory";
import type {
  EiaWeeklyInventoryLatestSummary,
  EiaWeeklyInventorySnapshot
} from "../types/Market";

interface UseEiaInventoryResult {
  error: Error | null;
  isLoading: boolean;
  latest: EiaWeeklyInventoryLatestSummary | null;
  snapshot: EiaWeeklyInventorySnapshot | null;
}

export function useEiaInventory(): UseEiaInventoryResult {
  const [snapshot, setSnapshot] = useState<EiaWeeklyInventorySnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchSnapshot() {
      try {
        const nextSnapshot = await loadEiaWeeklyInventorySnapshot();

        if (!isActive) {
          return;
        }

        setSnapshot(nextSnapshot);
        setError(null);
      } catch (nextError) {
        if (!isActive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Failed to load EIA inventory snapshot")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchSnapshot();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    error,
    isLoading,
    latest: snapshot?.latest ?? null,
    snapshot
  };
}
