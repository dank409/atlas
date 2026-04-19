import { useEffect, useState } from "react";
import { loadWarRiskSnapshot } from "../services/warRisk";
import type { WarRiskSnapshot } from "../types/WarRisk";

interface UseWarRiskResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: WarRiskSnapshot | null;
}

export function useWarRisk(): UseWarRiskResult {
  const [snapshot, setSnapshot] = useState<WarRiskSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    async function fetchSnapshot() {
      try {
        const next = await loadWarRiskSnapshot();
        if (!isActive) return;
        setSnapshot(next);
        setError(null);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err : new Error("War-risk load failed"));
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
