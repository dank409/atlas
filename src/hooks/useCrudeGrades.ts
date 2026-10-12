import { useEffect, useState } from "react";
import { loadCrudeGradeSnapshot } from "../services/crudeGrades";
import type { CrudeGradeSnapshot } from "../types/CrudeGrade";

export interface UseCrudeGradesResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: CrudeGradeSnapshot | null;
}

/** Loads the static crude-grade reference snapshot once, on mount. */
export function useCrudeGrades(): UseCrudeGradesResult {
  const [snapshot, setSnapshot] = useState<CrudeGradeSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchGrades() {
      try {
        const nextSnapshot = await loadCrudeGradeSnapshot();

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
            : new Error("Failed to load crude grade snapshot")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchGrades();

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
