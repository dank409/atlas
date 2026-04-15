import { useEffect, useState } from "react";
import { loadOutageEventSnapshot } from "../services/outageEvents";
import type { OutageEventSnapshot } from "../types/outageEvent";

interface UseOutageEventsResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: OutageEventSnapshot | null;
}

/**
 * Loads the curated outage event log on mount. Mirrors the
 * `useIceSettlements` / `useCrudeGrades` shape so consumers branch on
 * `isLoading` / `snapshot` uniformly. No refetch interval — the curator
 * updates the underlying JSON as new events occur.
 */
export function useOutageEvents(): UseOutageEventsResult {
  const [snapshot, setSnapshot] = useState<OutageEventSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchEvents() {
      try {
        const nextSnapshot = await loadOutageEventSnapshot();

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
            : new Error("Failed to load outage event snapshot")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchEvents();

    return () => {
      isActive = false;
    };
  }, []);

  return { error, isLoading, snapshot };
}
