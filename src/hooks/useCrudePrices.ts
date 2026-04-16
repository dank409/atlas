import { useEffect, useMemo, useRef, useState } from "react";
import { loadCrudePriceSnapshot } from "../services/eiaPrices";
import { loadDmeOmanSnapshot } from "../services/dmeOman";
import { loadMurbanSnapshot } from "../services/murban";
import { fetchLivePrices, type LivePriceResult } from "../services/livePrices";
import { buildCrudeMarketSummary } from "../utils/marketSummary";
import type {
  CrudeMarketSummary,
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot
} from "../types/Market";

interface UseCrudePricesResult {
  error: Error | null;
  isLoading: boolean;
  snapshot: CrudePriceSnapshot | null;
  dmeOmanSnapshot: DmeOmanSnapshot | null;
  murbanSnapshot: MurbanSnapshot | null;
  summary: CrudeMarketSummary | null;
}

// How often to poll the live-prices serverless function (ms).
// 60 seconds matches the Vercel CDN s-maxage, so each poll hits a
// fresh upstream Yahoo call rather than a stale CDN copy.
const LIVE_POLL_INTERVAL_MS = 60_000;

/**
 * Two-tier crude price hook:
 *
 *   Tier 1 — Static baseline (instant render)
 *     On mount, loads the nightly-refreshed JSON snapshots from
 *     `/data/market/`. This gives the UI something to show immediately
 *     — Brent, WTI, DME Oman, Murban with a STATIC badge. Runs once.
 *
 *   Tier 2 — Live overlay (near-real-time)
 *     Every 60 seconds, polls `/api/prices` — a Vercel Python Lambda
 *     that calls yfinance for BZ=F (Brent) and CL=F (WTI). When the
 *     response arrives, the hook overlays the live price onto the
 *     latest slot of the static series and flips the mode to LIVE.
 *     If the Lambda is cold-starting, Yahoo is down, or the market is
 *     closed and yfinance returns stale data, the hook silently keeps
 *     the Tier 1 static data — no error state, no empty render.
 *
 * Downstream consumers (MarketTape, DashboardView, situation room)
 * read the same `summary` / `snapshot` regardless of which tier is
 * active — the LIVE/STATIC badge flips automatically.
 */
export function useCrudePrices(): UseCrudePricesResult {
  const [snapshot, setSnapshot] = useState<CrudePriceSnapshot | null>(null);
  const [dmeOmanSnapshot, setDmeOmanSnapshot] = useState<DmeOmanSnapshot | null>(null);
  const [murbanSnapshot, setMurbanSnapshot] = useState<MurbanSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Live-price overlay. When non-null, the summary builder uses this
  // instead of the tail of the static series, and the mode flips to LIVE.
  const [livePrices, setLivePrices] = useState<LivePriceResult | null>(null);

  // Ref to track whether the component is still mounted. Prevents
  // stale setState calls if the component unmounts mid-fetch.
  const isActiveRef = useRef(true);
  useEffect(() => {
    isActiveRef.current = true;
    return () => { isActiveRef.current = false; };
  }, []);

  // --- Tier 1: static baseline (runs once) ---
  useEffect(() => {
    async function fetchBaseline() {
      try {
        const [crudeResult, dmeOmanResult, murbanResult] = await Promise.allSettled([
          loadCrudePriceSnapshot(),
          loadDmeOmanSnapshot(),
          loadMurbanSnapshot()
        ]);

        if (!isActiveRef.current) return;

        if (crudeResult.status === "rejected") {
          throw crudeResult.reason instanceof Error
            ? crudeResult.reason
            : new Error("Failed to load crude prices");
        }

        setSnapshot(crudeResult.value);
        setDmeOmanSnapshot(
          dmeOmanResult.status === "fulfilled" ? dmeOmanResult.value : null
        );
        setMurbanSnapshot(
          murbanResult.status === "fulfilled" ? murbanResult.value : null
        );
        setError(null);
      } catch (nextError) {
        if (!isActiveRef.current) return;
        setError(nextError instanceof Error ? nextError : new Error("Failed to load crude prices"));
      } finally {
        if (isActiveRef.current) {
          setIsLoading(false);
        }
      }
    }

    fetchBaseline();
  }, []);

  // --- Tier 2: live overlay (polls every 60s) ---
  useEffect(() => {
    // Don't start polling until the static baseline has loaded —
    // otherwise the first LIVE poll could resolve before the static
    // snapshots, producing a summary with a live Brent but no WTI
    // series for the sparkline.
    if (isLoading) return;

    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const live = await fetchLivePrices();
        if (isActiveRef.current) {
          setLivePrices(live);
        }
      } catch {
        // Non-fatal: keep showing the static baseline. Don't clear
        // a previously-successful live result — the stale live price
        // from 60 seconds ago is still better than the 24-hour-old
        // static price. Only clear on unmount (ref check above).
      }
      // Schedule the next tick regardless of success/failure.
      if (isActiveRef.current) {
        pollTimer = setTimeout(poll, LIVE_POLL_INTERVAL_MS);
      }
    }

    // Fire the first poll immediately (don't wait 60s for the first
    // live price to appear — the user opened the page and wants to
    // see LIVE as fast as possible).
    poll();

    return () => {
      if (pollTimer !== null) {
        clearTimeout(pollTimer);
      }
    };
  }, [isLoading]);

  // --- Summary builder: merges static baseline + live overlay ---
  const summary = useMemo(() => {
    if (!snapshot) return null;

    // If we have live prices, build a patched snapshot that replaces
    // the latest Brent/WTI values with the real-time numbers and
    // flips the mode to LIVE. The full 30-day series stays intact
    // for the sparkline — only the tail point changes.
    if (livePrices && (livePrices.brent || livePrices.wti)) {
      const patchedSnapshot: CrudePriceSnapshot = {
        ...snapshot,
        mode: "LIVE",
        asOf: livePrices.timestamp.slice(0, 10),
        source: livePrices.source
      };

      // Replace the last point in each series with the live quote
      // if available. This makes buildBenchmarkQuote see the live
      // price as "latest" and compute change vs the previous static
      // point — which is yesterday's close, exactly the delta a
      // trader expects for an intraday quote.
      if (livePrices.brent) {
        const liveBrentPoint = {
          date: new Date().toISOString().slice(0, 10),
          value: livePrices.brent.price
        };
        patchedSnapshot.series = {
          ...patchedSnapshot.series,
          brent: [...snapshot.series.brent.slice(0, -1), liveBrentPoint]
        };
      }
      if (livePrices.wti) {
        const liveWtiPoint = {
          date: new Date().toISOString().slice(0, 10),
          value: livePrices.wti.price
        };
        patchedSnapshot.series = {
          ...patchedSnapshot.series,
          wti: [...snapshot.series.wti.slice(0, -1), liveWtiPoint]
        };
      }

      return buildCrudeMarketSummary({
        crude: patchedSnapshot,
        dmeOman: dmeOmanSnapshot,
        murban: murbanSnapshot
      });
    }

    // No live data — use the static baseline as-is.
    return buildCrudeMarketSummary({
      crude: snapshot,
      dmeOman: dmeOmanSnapshot,
      murban: murbanSnapshot
    });
  }, [snapshot, dmeOmanSnapshot, murbanSnapshot, livePrices]);

  return {
    error,
    isLoading,
    snapshot,
    dmeOmanSnapshot,
    murbanSnapshot,
    summary
  };
}
