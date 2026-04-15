import { useEffect, useState } from "react";
import { loadIceBrentSettlementSnapshot } from "../services/iceSettlements";
import type { IceBrentSettlementSnapshot } from "../types/IceSettlements";

interface UseIceSettlementsResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: IceBrentSettlementSnapshot | null;
}

/**
 * Hook wrapper around `loadIceBrentSettlementSnapshot`. Mirrors the
 * shape of `useCrudePrices` so consumers can treat the two data streams
 * symmetrically and branch on `isLoading` / `snapshot` without special
 * cases for ICE vs EIA.
 */
export function useIceSettlements(): UseIceSettlementsResult {
  const [snapshot, setSnapshot] = useState<IceBrentSettlementSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchStrip() {
      try {
        const nextSnapshot = await loadIceBrentSettlementSnapshot();

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
            : new Error("Failed to load ICE Brent settlements")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchStrip();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    error,
    isLoading,
    snapshot
  };
}
