import { useEffect, useState } from "react";
import {
  loadBrentHistoricalSnapshot,
  type BrentHistoricalSnapshot
} from "../services/brentHistorical";

interface UseBrentHistoricalResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: BrentHistoricalSnapshot | null;
}

/**
 * Loads the historical Brent weekly series on mount. Separate from
 * `useCrudePrices` because the tape wants a fresh 30-day window while
 * the historical chart wants years of context, so the two snapshots
 * have different refresh cadences and byte budgets.
 */
export function useBrentHistorical(): UseBrentHistoricalResult {
  const [snapshot, setSnapshot] = useState<BrentHistoricalSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchHistory() {
      try {
        const nextSnapshot = await loadBrentHistoricalSnapshot();

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
            : new Error("Failed to load Brent historical snapshot")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      isActive = false;
    };
  }, []);

  return { error, isLoading, snapshot };
}
