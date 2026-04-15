import type {
  GdeltHeadline,
  GdeltNewsSnapshot,
  GdeltRawArticle,
  GdeltRawResponse
} from "../types/Gdelt";

// GDELT 2.0 Doc API is one of the rare public feeds that:
//   1. emits `Access-Control-Allow-Origin: *` (verified 2026-04-15)
//   2. requires no auth key
//   3. updates every 15 minutes
//   4. is legally permissive for display with attribution
//
// That combination makes it the ONLY source in the ATLAS feed graph
// that can safely run in pure LIVE mode directly from the browser —
// no GitHub Actions proxy required. We still keep a STATIC_SNAPSHOT
// fallback so the UI always has something to render when:
//   - GDELT is rate-limiting us (strict 1 req / 5s per IP)
//   - the user is offline
//   - GDELT itself is down
//
// Query strategy:
//   The API rejects compound OR-queries with any short term as
//   "phrase too short" (verified experimentally). A single tight
//   phrase works reliably. We default to `"Strait of Hormuz"` because
//   it is the single most relevant phrase to the Connecting Thread
//   question (CLAUDE.md): "given a disruption at Hormuz, what breaks?".
//   The phrase is overrideable via VITE_GDELT_QUERY so future operators
//   can swap in alternatives without touching this file.

const STATIC_SNAPSHOT_PATH = "/data/news/gdelt_seed.json";
const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const DEFAULT_QUERY = '"Strait of Hormuz" sourcelang:eng';
const MAX_RECORDS = 15;

export async function loadGdeltNewsSnapshot(): Promise<GdeltNewsSnapshot> {
  const query = resolveQuery();

  try {
    return await loadLiveGdeltNews(query);
  } catch {
    // Live fetch failed — fall through to the static snapshot. The
    // most common reason is GDELT's 5-second IP rate limit, which is
    // invisible to fetch() (it returns a 429 with a plain-text body).
    // Staying on STATIC mode is preferable to a blank panel.
  }

  return loadStaticGdeltNews();
}

function resolveQuery(): string {
  const override = import.meta.env.VITE_GDELT_QUERY;

  if (typeof override === "string" && override.trim().length > 0) {
    return override.trim();
  }

  return DEFAULT_QUERY;
}

async function loadLiveGdeltNews(query: string): Promise<GdeltNewsSnapshot> {
  const url = new URL(GDELT_BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", String(MAX_RECORDS));
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`GDELT fetch failed: ${response.status}`);
  }

  // GDELT occasionally returns HTTP 200 with a plain-text rejection
  // like "The specified phrase is too short." — guard by sniffing
  // content-type before trusting the JSON parser.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error("GDELT returned non-JSON response");
  }

  const payload = (await response.json()) as GdeltRawResponse;
  const headlines = normaliseArticles(payload.articles ?? []);

  if (headlines.length === 0) {
    throw new Error("GDELT returned an empty article list");
  }

  return {
    asOf: new Date().toISOString(),
    mode: "LIVE",
    query,
    headlines,
    source: "GDELT 2.0 Doc API (live)"
  };
}

async function loadStaticGdeltNews(): Promise<GdeltNewsSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load static GDELT snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as GdeltNewsSnapshot;

  if (!payload.headlines?.length) {
    throw new Error("Static GDELT snapshot is empty");
  }

  return {
    ...payload,
    mode: "STATIC_SNAPSHOT"
  };
}

/**
 * Normalises a raw GDELT article list into UI-ready headlines.
 * Exported for testing.
 *
 * Responsibilities:
 *   - parse compact `seendate` (`YYYYMMDDTHHMMSSZ`) into ISO 8601
 *   - trim and collapse whitespace in titles
 *   - drop records missing a URL or parseable date
 *   - dedupe by URL (GDELT sometimes returns the same story twice
 *     when multiple mirrors picked up the wire copy)
 *   - sort most-recent-first
 */
export function normaliseArticles(
  raw: GdeltRawArticle[]
): GdeltHeadline[] {
  const seenUrls = new Set<string>();
  const headlines: GdeltHeadline[] = [];

  for (const article of raw) {
    if (!article?.url || seenUrls.has(article.url)) {
      continue;
    }

    const publishedAt = parseGdeltSeenDate(article.seendate);
    if (!publishedAt) {
      continue;
    }

    const title = cleanTitle(article.title);
    if (!title) {
      continue;
    }

    seenUrls.add(article.url);
    headlines.push({
      url: article.url,
      title,
      publishedAt,
      domain: article.domain ?? "",
      sourceCountry: article.sourcecountry ?? "",
      language: article.language ?? ""
    });
  }

  return headlines.sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)
  );
}

/**
 * Parses GDELT's compact seendate format (`20260415T091500Z`) into a
 * conventional ISO 8601 string (`2026-04-15T09:15:00Z`). Returns an
 * empty string for anything we can't confidently parse — callers drop
 * the record rather than display a bogus timestamp.
 */
export function parseGdeltSeenDate(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  // Expected shape: YYYYMMDDTHHMMSSZ (16 chars) — GDELT is strict.
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw);
  if (!match) {
    return "";
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function cleanTitle(raw: string | undefined): string {
  if (!raw) {
    return "";
  }
  return raw.replace(/\s+/g, " ").trim();
}
