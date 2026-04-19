import { useEffect, useState } from "react";
import { loadFlowSnapshot } from "../services/crudeFlows";
import type { FlowSnapshot } from "../types/Flows";

interface UseCrudeFlowsResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: FlowSnapshot | null;
}

export function useCrudeFlows(): UseCrudeFlowsResult {
  const [snapshot, setSnapshot] = useState<FlowSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    async function run() {
      try {
        const next = await loadFlowSnapshot();
        if (!isActive) return;
        setSnapshot(next);
        setError(null);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err : new Error("Flows load failed"));
      } finally {
        if (isActive) setIsLoading(false);
      }
    }
    run();
    return () => {
      isActive = false;
    };
  }, []);

  return { snapshot, error, isLoading };
}
