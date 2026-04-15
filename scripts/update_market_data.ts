#!/usr/bin/env tsx

/**
 * Atlas nightly data refresh — the "Poor Man's API" engine.
 *
 * ============================================================
 *   Why this script exists
 * ============================================================
 *
 * Without this, Atlas is a movie set: the UI looks real but the
 * JSON files behind it are frozen at whatever date someone last
 * hand-edited them. A senior quant looking at the terminal can
 * spot "STATIC | AS OF 2026-04-13" on the top right and know
 * immediately that the plumbing is fake.
 *
 * This script turns the terminal into an instrument with an
 * automated heartbeat:
 *
 *   1. GitHub Actions runs it nightly (see
 *      .github/workflows/daily_data_refresh.yml).
 *   2. It pulls fresh data from real public endpoints.
 *   3. It rewrites the static JSON files the running app reads.
 *   4. The workflow commits the diff back to main.
 *   5. The next deploy (or the running static site, if it
 *      refetches on page load) picks up the fresh numbers.
 *
 * Total infra cost: $0. Total moving parts beyond the client
 * codebase: one script, one workflow file, two repo secrets.
 *
 * ============================================================
 *   Upstream sources
 * ============================================================
 *
 * EIA v2 petroleum/pri/spt (Brent + WTI spot prices)
 *   https://api.eia.gov/v2/petroleum/pri/spt/data/
 *   Free tier, unlimited daily calls, <1h rate limit reset.
 *   Register at https://www.eia.gov/opendata/ and set EIA_API_KEY.
 *
 * FRED (Federal Reserve Economic Data, St. Louis Fed)
 *   https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}
 *   Used as (a) the primary when no EIA key is set and (b) the
 *   automatic fallback when EIA returns empty / 5xx. A fresh
 *   clone with ZERO secrets still gets live Brent + WTI on its
 *   first cron run — that's the point. FRED publishes the same
 *   EIA spot series (DCOILBRENTEU = Brent, DCOILWTICO = WTI) as
 *   a keyless CSV with history back to 1987, lagged one business
 *   day vs the raw EIA feed.
 *
 *   Historical notes on dead fallback choices:
 *     - Stooq CSV (bc.c / cl.c): added per-download captcha in
 *       Q2 2026, breaking any automated use.
 *     - Yahoo Finance (BZ=F / CL=F): Yahoo's CDN fingerprints
 *       Node's undici fetch and 429s it even with a Mozilla UA.
 *       Works from curl, fails from Node. Dead end for this
 *       script's transport.
 *   If FRED ever goes the same way, the next candidate is the
 *   IMF commodity data portal (also keyless CSV).
 *
 *   Series we use:
 *     DCOILBRENTEU  → Brent Crude, daily, $/bbl
 *     DCOILWTICO    → WTI Crude, daily, $/bbl
 *
 * NASA FIRMS (VIIRS_SNPP_NRT satellite thermal anomalies)
 *   https://firms.modaps.eosdis.nasa.gov/api/country/csv/
 *   Free tier, CSV only (no JSON equivalent). Register at
 *   https://firms.modaps.eosdis.nasa.gov/api/map_key/ and set
 *   FIRMS_MAP_KEY. No keyless fallback exists — this leg is
 *   skipped cleanly when the env var is missing.
 *
 * ============================================================
 *   What this script does NOT touch
 * ============================================================
 *
 * DME Oman settlements, IFAD Murban settlements, and the ICE
 * Brent M1-M12 forward strip are intentionally NOT refreshed by
 * this pipeline. Reasons:
 *
 *   - DME Oman publishes settlements as a PDF behind an
 *     IP-whitelisted CDN.
 *   - IFAD Murban settlements are inside ICE Chat / IFEU which
 *     requires a licensed vendor subscription.
 *   - The ICE Brent forward strip would require scraping the
 *     ICE settlement page, which has anti-bot measures, and
 *     Stooq does not carry all 12 monthly Brent contracts
 *     reliably.
 *
 * Trying to auto-refresh any of those with a bad proxy would be
 * worse than leaving the curated files alone — it would put
 * wrong numbers in front of a trader. The honest answer is
 * "these three files need manual curation until a licensed feed
 * is provisioned," which is documented in docs/DATA_SOURCES.md.
 *
 * Infrastructure layers (refineries, pipelines, fields,
 * terminals) come from Global Energy Monitor quarterly drops
 * and are built by scripts/build_workspace_data.py, not this
 * script. Outage events are human-classified and stay curated.
 *
 * ============================================================
 *   Usage
 * ============================================================
 *
 *   npm run refresh:data                # run every leg
 *   npm run refresh:data:eia            # just EIA/Stooq spot
 *   npm run refresh:data:brent-hist     # just Brent 5y weekly
 *   npm run refresh:data:firms          # just FIRMS detections
 *
 *   # Or invoke tsx directly with explicit env vars:
 *   EIA_API_KEY=xxx FIRMS_MAP_KEY=yyy npx tsx scripts/update_market_data.ts
 *
 * ============================================================
 *   Exit codes
 * ============================================================
 *
 *   0   At least one leg wrote data (or determined the existing
 *       data is already fresh). The CI workflow will still
 *       commit the diff if anything changed.
 *   1   Every leg failed. The CI workflow will mark the job red.
 *   2   Unknown subcommand.
 */

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ===================================================================
//   Paths and environment
// ===================================================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const DATA_ROOT = join(REPO_ROOT, "public", "data");

const TARGET_EIA_SPOT = join(DATA_ROOT, "market", "crude_prices_30d.json");
const TARGET_BRENT_HIST = join(DATA_ROOT, "market", "brent_historical_5y.json");
const TARGET_FIRMS = join(DATA_ROOT, "firms", "recent_detections.json");

const EIA_API_KEY = process.env.EIA_API_KEY ?? "";
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY ?? "";

// ===================================================================
//   Logging — one line per event, colour only on a TTY so CI logs
//   stay grep-friendly.
// ===================================================================

const isTty = Boolean(process.stdout.isTTY);
const ANSI = {
  reset: isTty ? "\x1b[0m" : "",
  dim: isTty ? "\x1b[2m" : "",
  red: isTty ? "\x1b[31m" : "",
  green: isTty ? "\x1b[32m" : "",
  amber: isTty ? "\x1b[33m" : "",
  cyan: isTty ? "\x1b[36m" : ""
};

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function logInfo(leg: string, msg: string): void {
  console.log(`${ANSI.dim}${ts()}${ANSI.reset} ${ANSI.cyan}[${leg}]${ANSI.reset} ${msg}`);
}
function logOk(leg: string, msg: string): void {
  console.log(`${ANSI.dim}${ts()}${ANSI.reset} ${ANSI.green}[${leg}] ✓${ANSI.reset} ${msg}`);
}
function logWarn(leg: string, msg: string): void {
  console.log(`${ANSI.dim}${ts()}${ANSI.reset} ${ANSI.amber}[${leg}] ⚠${ANSI.reset} ${msg}`);
}
function logFail(leg: string, msg: string): void {
  console.error(`${ANSI.dim}${ts()}${ANSI.reset} ${ANSI.red}[${leg}] ✗${ANSI.reset} ${msg}`);
}

// ===================================================================
//   HTTP with timeout + retry. Node 20+ has global fetch, so no
//   dependency on node-fetch — one less thing to lock-file-pin.
// ===================================================================

const HTTP_TIMEOUT_MS = 30_000;
const HTTP_MAX_RETRIES = 3;
const USER_AGENT =
  "atlas-data-refresh/1.0 (+https://github.com/daniyalkahloon/energy-terminal)";

async function httpFetch(url: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= HTTP_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, ...(init?.headers ?? {}) },
        signal: controller.signal
      });
      // Retry 5xx and 429 (rate limit). 4xx other than 429 usually
      // means "your request is wrong" — no point retrying those.
      if (
        (response.status >= 500 || response.status === 429) &&
        attempt < HTTP_MAX_RETRIES
      ) {
        clearTimeout(timer);
        // Honour Retry-After if upstream sent one, otherwise
        // exponential backoff: 2s, 4s, 8s. Yahoo in particular
        // needs a longer cooldown than the default 500ms×attempt.
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : 0;
        const backoffMs = Math.max(retryAfterMs, 2000 * Math.pow(2, attempt - 1));
        await delay(backoffMs);
        continue;
      }
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < HTTP_MAX_RETRIES) {
        await delay(2000 * Math.pow(2, attempt - 1));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===================================================================
//   Atomic JSON write — temp file + rename so a crash mid-write
//   never leaves a half-written target JSON on disk. Uses 2-space
//   indent + trailing newline so git diffs are line-oriented and
//   merge cleanly.
// ===================================================================

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const serialized = JSON.stringify(data, null, 2) + "\n";
  const tmpPath = `${filePath}.tmp`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmpPath, serialized, "utf8");
  await rename(tmpPath, filePath);
}

// ===================================================================
//   Types — intentionally loose here so this script doesn't import
//   from src/types/* (which would couple Node-side tooling to
//   client-side Vite build config). Shapes match what the client
//   readers in src/services/*.ts parse out of these files.
// ===================================================================

interface PricePoint {
  date: string; // YYYY-MM-DD
  value: number;
}

interface CrudeSpotFile {
  source: string;
  mode: "STATIC_SNAPSHOT";
  asOf: string;
  note?: string;
  series: {
    brent: PricePoint[];
    wti: PricePoint[];
  };
}

interface BrentHistoricalFile {
  mode: "STATIC_SNAPSHOT";
  asOf: string;
  source: string;
  note?: string;
  frequency: "daily" | "weekly";
  series: {
    brent: PricePoint[];
  };
}

interface FirmsDetectionFile {
  id: string;
  latitude: number;
  longitude: number;
  acquiredAt: string;
  satellite: string;
  confidenceRaw: string | number;
  confidenceScore: number;
  frp: number;
  dayNight: "D" | "N";
  brightness: number;
}

interface FirmsFileShape {
  asOf: string;
  source: string;
  note?: string;
  detections: FirmsDetectionFile[];
}

// ===================================================================
//   EIA v2 helpers
// ===================================================================

const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/spt/data/";

async function fetchEiaSeries(
  product: "EPCBRENT" | "EPCWTI",
  length: number
): Promise<PricePoint[]> {
  if (!EIA_API_KEY) {
    throw new Error("EIA_API_KEY is not set");
  }
  const url = new URL(EIA_BASE);
  url.searchParams.set("api_key", EIA_API_KEY);
  url.searchParams.set("frequency", "daily");
  url.searchParams.append("data[0]", "value");
  url.searchParams.append("facets[product][]", product);
  url.searchParams.append("sort[0][column]", "period");
  url.searchParams.append("sort[0][direction]", "desc");
  url.searchParams.set("length", String(length));

  const res = await httpFetch(url.toString());
  if (!res.ok) {
    throw new Error(`EIA ${product} HTTP ${res.status}`);
  }
  const payload = (await res.json()) as {
    response?: {
      data?: Array<{ period?: string; value?: number | string | null }>;
    };
  };
  const rows = payload.response?.data ?? [];
  return rows
    .map((row) => ({
      date: row.period ?? "",
      // Null becomes NaN (not 0) so the finite filter drops it.
      // EIA occasionally emits { value: null } for unpublished days
      // and Number(null) === 0 would poison the latest-price
      // selector downstream.
      value:
        typeof row.value === "number"
          ? row.value
          : row.value == null
            ? NaN
            : Number(row.value)
    }))
    .filter((p) => p.date && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ===================================================================
//   FRED helpers — free, keyless, daily CSV from the St. Louis Fed.
//   FRED publishes the same EIA daily spot series under stable IDs:
//
//     DCOILBRENTEU  Brent Crude ($/bbl, daily close)
//     DCOILWTICO    WTI Crude ($/bbl, daily close)
//
//   Advantages over Yahoo / Stooq: no captcha, no TLS fingerprinting,
//   no browser user-agent dance, clean two-column CSV, history
//   back to the mid-80s. The one downside is one-business-day lag
//   vs the raw EIA feed — a non-issue for a nightly cron.
//
//   FRED emits `.` for missing observations (weekends, holidays,
//   unpublished days). We drop those rows.
// ===================================================================

const FRED_CSV_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv";

async function fetchFredDaily(
  seriesId: "DCOILBRENTEU" | "DCOILWTICO",
  maxRows: number
): Promise<PricePoint[]> {
  const url = `${FRED_CSV_BASE}?id=${encodeURIComponent(seriesId)}`;
  const res = await httpFetch(url);
  if (!res.ok) {
    throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  }
  const text = await res.text();
  const parsed = parseFredCsv(text, seriesId);
  if (parsed.length === 0) {
    throw new Error(`FRED ${seriesId} returned no rows`);
  }
  // FRED is oldest-first. Keep the last `maxRows`.
  return parsed.slice(-maxRows);
}

function parseFredCsv(raw: string, seriesId: string): PricePoint[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  // Header looks like: "observation_date,DCOILBRENTEU"
  const header = lines[0].split(",").map((c) => c.trim());
  const dateIdx = header.indexOf("observation_date");
  const valueIdx = header.indexOf(seriesId);
  if (dateIdx === -1 || valueIdx === -1) {
    return [];
  }

  const out: PricePoint[] = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cols = lines[r].split(",");
    const date = (cols[dateIdx] ?? "").trim();
    const rawValue = (cols[valueIdx] ?? "").trim();
    // FRED uses "." as the missing-value marker. Skip those rows
    // entirely — they're weekends, holidays, or not-yet-published
    // days. Number(".") would be NaN anyway but the explicit guard
    // makes the intent obvious.
    if (!date || rawValue === "" || rawValue === ".") {
      continue;
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      continue;
    }
    out.push({ date, value });
  }
  return out;
}

// ===================================================================
//   Leg 1 — EIA / Stooq crude spot prices
// ===================================================================

async function refreshEiaSpot(): Promise<void> {
  const leg = "EIA-SPOT";
  logInfo(leg, "refreshing Brent + WTI 30d");

  let brent: PricePoint[] = [];
  let wti: PricePoint[] = [];
  let sourceLabel: string;

  if (EIA_API_KEY) {
    try {
      [brent, wti] = await Promise.all([
        fetchEiaSeries("EPCBRENT", 30),
        fetchEiaSeries("EPCWTI", 30)
      ]);
      sourceLabel = `EIA v2 petroleum/pri/spt (refreshed ${todayIsoDate()})`;
    } catch (err) {
      logWarn(leg, `EIA failed (${errToString(err)}), falling back to FRED`);
      [brent, wti] = await Promise.all([
        fetchFredDaily("DCOILBRENTEU", 30),
        fetchFredDaily("DCOILWTICO", 30)
      ]);
      sourceLabel = `FRED DCOILBRENTEU + DCOILWTICO (EIA fallback, refreshed ${todayIsoDate()})`;
    }
  } else {
    logWarn(leg, "EIA_API_KEY not set, using FRED directly");
    [brent, wti] = await Promise.all([
      fetchFredDaily("DCOILBRENTEU", 30),
      fetchFredDaily("DCOILWTICO", 30)
    ]);
    sourceLabel = `FRED DCOILBRENTEU + DCOILWTICO (no EIA key, refreshed ${todayIsoDate()})`;
  }

  if (brent.length === 0 || wti.length === 0) {
    throw new Error("empty Brent/WTI series from upstream");
  }

  const asOf = brent[brent.length - 1]?.date ?? todayIsoDate();
  const payload: CrudeSpotFile = {
    source: sourceLabel,
    mode: "STATIC_SNAPSHOT",
    asOf,
    note:
      "Refreshed nightly by scripts/update_market_data.ts. Mode stays " +
      "STATIC_SNAPSHOT because the client still reads from this file — the " +
      "freshness comes from daily cron overwrites, not from a live client fetch.",
    series: { brent, wti }
  };
  await writeJsonAtomic(TARGET_EIA_SPOT, payload);
  logOk(leg, `${brent.length} Brent + ${wti.length} WTI rows, asOf=${asOf}`);
}

// ===================================================================
//   Leg 2 — Brent historical (5y daily → weekly resample)
// ===================================================================

async function refreshBrentHistorical(): Promise<void> {
  const leg = "BRENT-HIST";
  logInfo(leg, "refreshing Brent 5y daily → weekly");

  let daily: PricePoint[] = [];
  let sourceLabel: string;

  // 5 years of trading days is ~1300 rows; EIA accepts up to 5000
  // per `length=` so this is well within limits.
  const FIVE_YEAR_ROWS = 1300;

  if (EIA_API_KEY) {
    try {
      daily = await fetchEiaSeries("EPCBRENT", FIVE_YEAR_ROWS);
      sourceLabel = `EIA v2 petroleum/pri/spt Brent 5y daily (refreshed ${todayIsoDate()})`;
    } catch (err) {
      logWarn(leg, `EIA failed (${errToString(err)}), falling back to FRED`);
      daily = await fetchFredDaily("DCOILBRENTEU", FIVE_YEAR_ROWS);
      sourceLabel = `FRED DCOILBRENTEU 5y daily (EIA fallback, refreshed ${todayIsoDate()})`;
    }
  } else {
    logWarn(leg, "EIA_API_KEY not set, using FRED directly");
    daily = await fetchFredDaily("DCOILBRENTEU", FIVE_YEAR_ROWS);
    sourceLabel = `FRED DCOILBRENTEU 5y daily (refreshed ${todayIsoDate()})`;
  }

  if (daily.length < 52) {
    throw new Error(
      `insufficient daily data for weekly resample (got ${daily.length} rows)`
    );
  }

  const weekly = resampleWeekly(daily);
  const payload: BrentHistoricalFile = {
    mode: "STATIC_SNAPSHOT",
    asOf: weekly[weekly.length - 1]?.date ?? todayIsoDate(),
    source: sourceLabel,
    note:
      "Weekly-resolution Brent series for the situation-room historical " +
      "chart. Refreshed nightly from the most recent 5 years of daily " +
      "observations, resampled to one observation per ISO week (last " +
      "trading day in the bucket wins).",
    frequency: "weekly",
    series: { brent: weekly }
  };
  await writeJsonAtomic(TARGET_BRENT_HIST, payload);
  logOk(
    leg,
    `${weekly.length} weekly rows (from ${daily.length} daily), asOf=${payload.asOf}`
  );
}

function resampleWeekly(daily: PricePoint[]): PricePoint[] {
  // Bucket by ISO week-year and take the LAST observation in each
  // bucket. Conventional financial weekly close is Friday, but we
  // let the data speak — the last trading day in each ISO week
  // becomes the weekly point. Holidays don't break this.
  const byWeek = new Map<string, PricePoint>();
  for (const point of daily) {
    const key = isoWeekKey(point.date);
    const existing = byWeek.get(key);
    if (!existing || point.date > existing.date) {
      byWeek.set(key, point);
    }
  }
  return Array.from(byWeek.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function isoWeekKey(isoDate: string): string {
  // Returns "YYYY-Www" — the ISO-8601 week identifier the point
  // belongs to. Thursday-anchored ISO week algorithm.
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return isoDate; // Unparseable — treat as its own week.
  }
  const thursday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  thursday.setUTCDate(thursday.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ===================================================================
//   Leg 3 — NASA FIRMS (VIIRS_SNPP_NRT) Middle East detections
//
//   IMPORTANT — API endpoint choice (deliberate deviation from the
//   client in src/services/firms.ts):
//
//   NASA deprecated the /api/country/csv/{KEY}/{SOURCE}/{ISO3}/{DAYS}
//   endpoint — every country ISO3 now returns a cryptic HTTP 400
//   "Invalid API call" regardless of key validity. The client-side
//   service still has the country fan-out code, but it falls through
//   to the static snapshot on every call. For the refresh pipeline
//   we use the AREA endpoint with a bounding box that covers the
//   entire Middle East region — one request instead of 14, no
//   per-country retry logic, and it actually works.
//
//     https://firms.modaps.eosdis.nasa.gov/api/area/csv/
//       {KEY}/{SOURCE}/{bbox}/{days}
//
//   bbox is `west,south,east,north` in decimal degrees. The
//   ME_BBOX below (33°E..60°E, 12°N..40°N) covers the Gulf, the
//   Levant, Egypt, and Turkey in one request and returns ~3000
//   detections for a 72h window.
// ===================================================================

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const FIRMS_SOURCE = "VIIRS_SNPP_NRT";
const FIRMS_DAYS = 3; // 72h window — matches the client's default.
const ME_BBOX = "33,12,60,40"; // W, S, E, N in decimal degrees.

async function refreshFirms(): Promise<void> {
  const leg = "FIRMS";
  if (!FIRMS_MAP_KEY) {
    // Not an error — just a deliberate skip. FIRMS requires a key
    // and there's no free public fallback. Throw here so main()
    // logs it as a fail and the exit-code logic can see it.
    throw new Error(
      "FIRMS_MAP_KEY is not set (no keyless fallback for FIRMS — skipping)"
    );
  }
  logInfo(leg, `fetching ME bbox ${ME_BBOX} × ${FIRMS_DAYS}d window`);

  const url = `${FIRMS_BASE}/${encodeURIComponent(FIRMS_MAP_KEY)}/${FIRMS_SOURCE}/${ME_BBOX}/${FIRMS_DAYS}`;
  const res = await httpFetch(url);
  if (!res.ok) {
    throw new Error(`FIRMS HTTP ${res.status}`);
  }
  const text = await res.text();
  const detections = parseFirmsCsv(text);
  if (detections.length === 0) {
    throw new Error("FIRMS returned no detections for the ME bbox");
  }

  const payload: FirmsFileShape = {
    asOf: new Date().toISOString(),
    source: `NASA FIRMS ${FIRMS_SOURCE} area bbox ${ME_BBOX} (refreshed ${todayIsoDate()})`,
    note: `Refreshed nightly by scripts/update_market_data.ts. Single area-bbox fetch covering the full Middle East region (Gulf + Levant + Egypt + Turkey). The client-side country fan-out path is dead upstream — NASA deprecated /api/country/csv/ and returns Invalid API call for every ISO3.`,
    detections
  };
  await writeJsonAtomic(TARGET_FIRMS, payload);
  logOk(leg, `${detections.length} detections from ME bbox`);
}

// Minimal FIRMS-CSV parser, mirrors src/services/firms.ts::parseFirmsCsv
// but stays local so this script doesn't need to import from client
// code that uses import.meta.env. The CSV format is stable (NASA
// hasn't changed it in years) so the duplication cost is low.
function parseFirmsCsv(raw: string): FirmsDetectionFile[] {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const latIdx = idx("latitude");
  const lonIdx = idx("longitude");
  const confIdx = idx("confidence");
  const dateIdx = idx("acq_date");
  const timeIdx = idx("acq_time");
  const satIdx = idx("satellite");
  const instIdx = idx("instrument");
  const frpIdx = idx("frp");
  const dnIdx = idx("daynight");
  const brightIdx =
    idx("bright_ti4") !== -1 ? idx("bright_ti4") : idx("brightness");

  const out: FirmsDetectionFile[] = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cols = lines[r].split(",");
    if (cols.length < header.length) continue;

    const lat = Number(cols[latIdx]);
    const lon = Number(cols[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const acqDate = (cols[dateIdx] ?? "").trim();
    const acqTime = (cols[timeIdx] ?? "").trim();
    const acquiredAt = combineFirmsDateTime(acqDate, acqTime);
    if (!acquiredAt) continue;

    const satelliteRaw = (cols[satIdx] ?? "").trim();
    const instrumentRaw = (cols[instIdx] ?? "").trim();
    const satellite = resolveSatellite(satelliteRaw, instrumentRaw);

    const confidenceRaw: string | number = satellite.startsWith("VIIRS")
      ? (cols[confIdx] ?? "").trim().toLowerCase()
      : Number(cols[confIdx]);
    const confidenceScore = normalizeConfidence(confidenceRaw);

    const frp = Number(cols[frpIdx]);
    const brightness = Number(cols[brightIdx]);
    const dayNight =
      (cols[dnIdx] ?? "D").trim().toUpperCase() === "N" ? "N" : "D";

    out.push({
      id: `${lat}|${lon}|${acqDate}|${acqTime}|${satellite}`,
      latitude: lat,
      longitude: lon,
      acquiredAt,
      satellite,
      confidenceRaw,
      confidenceScore,
      frp: Number.isFinite(frp) ? frp : 0,
      dayNight,
      brightness: Number.isFinite(brightness) ? brightness : 0
    });
  }
  return out;
}

function combineFirmsDateTime(date: string, time: string): string | null {
  if (!date) return null;
  const t = time.padStart(4, "0");
  const iso = `${date}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function resolveSatellite(sat: string, instrument: string): string {
  if (sat.includes("N")) return "VIIRS_SNPP";
  if (sat.includes("1")) return "VIIRS_NOAA20";
  if (instrument.toLowerCase().includes("modis")) return "MODIS";
  return "VIIRS_SNPP";
}

function normalizeConfidence(raw: string | number): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }
  const n = raw.trim().toLowerCase();
  if (n === "low" || n === "l") return 40;
  if (n === "nominal" || n === "n") return 75;
  if (n === "high" || n === "h") return 95;
  const parsed = Number(n);
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
  return 0;
}

// ===================================================================
//   Utilities
// ===================================================================

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function errToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ===================================================================
//   Entry point
// ===================================================================

type LegName = "eia-spot" | "brent-hist" | "firms";

const LEGS: Record<LegName, () => Promise<void>> = {
  "eia-spot": refreshEiaSpot,
  "brent-hist": refreshBrentHistorical,
  firms: refreshFirms
};

function resolveLegs(arg: string): LegName[] {
  if (arg === "all") {
    return Object.keys(LEGS) as LegName[];
  }
  if (arg in LEGS) {
    return [arg as LegName];
  }
  console.error(`Unknown subcommand: ${arg}`);
  console.error(
    `Usage: update_market_data.ts [all|${Object.keys(LEGS).join("|")}]`
  );
  process.exit(2);
}

async function main(): Promise<void> {
  const arg = (process.argv[2] ?? "all").toLowerCase();
  const toRun = resolveLegs(arg);

  let okCount = 0;
  let failCount = 0;

  for (const leg of toRun) {
    try {
      await LEGS[leg]();
      okCount += 1;
    } catch (err) {
      failCount += 1;
      logFail(leg.toUpperCase(), errToString(err));
    }
  }

  console.log("");
  console.log(
    `${ANSI.cyan}[SUMMARY]${ANSI.reset} ${okCount} ok, ${failCount} failed (${toRun.length} total)`
  );

  if (okCount === 0) {
    // Every leg failed — the static files are untouched, so the
    // commit step in CI will see no diff and skip. Exit 1 so the
    // workflow job still goes red and whoever owns the repo gets
    // a failure notification.
    console.error(`${ANSI.red}All legs failed; exiting 1${ANSI.reset}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${errToString(err)}`);
  process.exit(1);
});
