/**
 * Client-side service for the /api/prices Vercel serverless function.
 * Returns near-real-time Brent + WTI futures prices from Yahoo Finance
 * via the Python Lambda. The hook layer (useCrudePrices) polls this
 * every 60 seconds and overlays the live price on top of the static
 * nightly-refreshed baseline.
 *
 * Error semantics:
 *   - Non-200 HTTP → throws (caller falls back to static)
 *   - 200 but both brent/wti are null → throws (same)
 *   - Network timeout → throws (same)
 *   - 200 with at least one quote → returns LivePriceResult
 *
 * The endpoint is Vercel CDN-cached (s-maxage=30, stale-while-revalidate=60)
 * so rapid polls from multiple tabs share one upstream Yahoo call.
 */

export interface LiveQuote {
  price: number;
  previousClose: number | null;
  change: number;
  changePct: number;
}

export interface LivePriceResult {
  brent: LiveQuote | null;
  wti: LiveQuote | null;
  timestamp: string;
  source: string;
}

const LIVE_PRICES_ENDPOINT = "/api/prices";
const FETCH_TIMEOUT_MS = 10_000;

export async function fetchLivePrices(): Promise<LivePriceResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(LIVE_PRICES_ENDPOINT, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`/api/prices HTTP ${response.status}`);
    }

    const payload = (await response.json()) as LivePriceResult;

    if (!payload.brent && !payload.wti) {
      throw new Error("/api/prices returned no quotes");
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}
