"""
Vercel Python serverless function — live oil futures prices.

Endpoint: GET /api/prices

Returns the current front-month WTI (CL=F) and Brent (BZ=F) futures
prices from Yahoo Finance via yfinance. These are the exact benchmarks
every news site quotes as "oil is at $X right now" — updated
continuously during market hours (~23 hours/day, 5 days/week) with a
standard ~10-15 minute delay for free-tier sources.

Architecture:
  - Vercel deploys this file as an AWS Lambda (Python 3.12 runtime)
  - The client's useCrudePrices hook polls /api/prices every 60 seconds
  - On success, the market tape flips from STATIC to LIVE and shows
    the real-time price + intraday change
  - On failure (Lambda cold start timeout, Yahoo down, market closed
    with stale data), the client keeps showing the nightly-refreshed
    static JSON — no crash, no empty state

Cache:
  - Cache-Control: s-maxage=30 means Vercel's CDN caches the response
    for 30 seconds. Multiple concurrent visitors share one upstream
    Yahoo call instead of each hitting yfinance independently.
  - stale-while-revalidate=60 means users get the cached response
    instantly while the CDN refreshes in the background on the next
    request after 30s — zero perceived latency.

Why yfinance instead of raw Yahoo JSON endpoints:
  - Yahoo's chart API (query1.finance.yahoo.com) fingerprints Node's
    TLS stack and 429s it. Python's ssl/urllib uses OpenSSL with a
    different JA3 fingerprint that Yahoo doesn't block.
  - yfinance handles Yahoo's auth/cookie dance, retry logic, and
    edge cases (market closed, contract rollover, etc.) so we don't
    have to.
"""

from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime, timezone


def get_live_prices() -> dict:
    """Fetch current WTI + Brent from Yahoo Finance via yfinance."""
    # Import inside the handler so the cold-start import cost is paid
    # once and cached by the Lambda runtime across warm invocations.
    import yfinance as yf

    result = {
        "brent": None,
        "wti": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "Yahoo Finance (yfinance) — ~10-15 min delay",
    }

    # --- Brent (ICE) ---
    try:
        bz = yf.Ticker("BZ=F")
        info = bz.fast_info
        brent_price = getattr(info, "last_price", None)
        brent_prev = getattr(info, "previous_close", None)
        if brent_price is not None and brent_price > 0:
            change = round(brent_price - brent_prev, 2) if brent_prev else 0
            change_pct = (
                round((change / brent_prev) * 100, 2)
                if brent_prev and brent_prev != 0
                else 0
            )
            result["brent"] = {
                "price": round(brent_price, 2),
                "previousClose": round(brent_prev, 2) if brent_prev else None,
                "change": change,
                "changePct": change_pct,
            }
    except Exception:
        # Non-fatal — we still try WTI even if Brent fails.
        pass

    # --- WTI (NYMEX) ---
    try:
        cl = yf.Ticker("CL=F")
        info = cl.fast_info
        wti_price = getattr(info, "last_price", None)
        wti_prev = getattr(info, "previous_close", None)
        if wti_price is not None and wti_price > 0:
            change = round(wti_price - wti_prev, 2) if wti_prev else 0
            change_pct = (
                round((change / wti_prev) * 100, 2)
                if wti_prev and wti_prev != 0
                else 0
            )
            result["wti"] = {
                "price": round(wti_price, 2),
                "previousClose": round(wti_prev, 2) if wti_prev else None,
                "change": change,
                "changePct": change_pct,
            }
    except Exception:
        pass

    return result


class handler(BaseHTTPRequestHandler):
    """Vercel serverless handler — GET /api/prices."""

    def do_GET(self):
        try:
            data = get_live_prices()

            # At least one benchmark must have resolved for the response
            # to be useful. If both failed, return 502 so the client
            # knows to fall back to the static snapshot.
            if data["brent"] is None and data["wti"] is None:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(
                    json.dumps(
                        {"error": "Yahoo Finance returned no prices for BZ=F or CL=F"}
                    ).encode()
                )
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            # CDN cache: 30s fresh, 60s stale-while-revalidate.
            # Visitors within the same 30s window share one Yahoo call.
            self.send_header(
                "Cache-Control",
                "public, s-maxage=30, stale-while-revalidate=60",
            )
            # Allow the client (different origin in dev) to read the
            # response. Vercel auto-adds CORS for same-origin but the
            # explicit header is a safety net for local dev + preview
            # deploys.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())

        except Exception as exc:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(
                json.dumps({"error": str(exc)}).encode()
            )

    def log_message(self, format, *args):
        """Suppress default stderr logging — Vercel captures stdout."""
        pass
