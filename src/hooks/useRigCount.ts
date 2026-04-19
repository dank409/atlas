import { useEffect, useState } from "react";
import { loadRigCountSnapshot } from "../services/bakerHughesRigs";
import type { RigCountSnapshot } from "../types/Rigs";

interface UseRigCountResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: RigCountSnapshot | null;
}

export function useRigCount(): UseRigCountResult {
  const [snapshot, setSnapshot] = useState<RigCountSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchSnapshot() {
      try {
        const next = await loadRigCountSnapshot();
        if (!isActive) return;
        setSnapshot(next);
        setError(null);
      } catch (nextError) {
        if (!isActive) return;
        setError(nextError instanceof Error ? nextError : new Error("Rig count load failed"));
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
