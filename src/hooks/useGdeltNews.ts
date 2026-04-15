import { useEffect, useState } from "react";
import { loadGdeltNewsSnapshot } from "../services/gdeltNews";
import type { GdeltNewsSnapshot } from "../types/Gdelt";

interface UseGdeltNewsResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: GdeltNewsSnapshot | null;
}

/**
 * Fetches the GDELT news snapshot exactly once on mount. We deliberately
 * do NOT poll on a timer:
 *   - GDELT enforces a strict 1 req / 5s per-IP rate limit that would
 *     trip on any interval below 6000ms and return a plain-text 429.
 *   - GDELT's own cache header is `max-age=900` (15 minutes), so polling
 *     faster would serve the user stale data regardless.
 *   - The terminal pattern is "data refresh is visible, not magical" —
 *     a future sprint will wire a manual refresh button or tie refresh
 *     to the 15-minute status-bar tick.
 */
export function useGdeltNews(): UseGdeltNewsResult {
  const [snapshot, setSnapshot] = useState<GdeltNewsSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchNews() {
      try {
        const nextSnapshot = await loadGdeltNewsSnapshot();

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
            : new Error("Failed to load GDELT news")
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchNews();

    return () => {
      isActive = false;
    };
  }, []);

  return { error, isLoading, snapshot };
}
