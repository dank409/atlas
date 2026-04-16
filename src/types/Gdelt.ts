import type { DataSourceMetadata } from "./DataSource";

/**
 * GDELT 2.0 Doc API — raw article record as returned by
 * `api.gdeltproject.org/api/v2/doc/doc` when called with `format=json`
 * and `mode=artlist`. The fields mirror the upstream schema verified
 * against a live response on 2026-04-15.
 *
 * Upstream schema reference:
 *   {
 *     "articles": [
 *       { url, url_mobile, title, seendate, socialimage, domain,
 *         language, sourcecountry }
 *     ]
 *   }
 *
 * Notable quirks:
 *   - `seendate` is compact ISO with no punctuation, e.g. "20260415T091500Z".
 *     Consumers must parse it before formatting for display.
 *   - `title` frequently contains awkward spaces around punctuation because
 *     GDELT tokenises source HTML. The UI trims whitespace defensively.
 *   - `socialimage` is often empty string rather than null.
 */
export interface GdeltRawArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

export interface GdeltRawResponse {
  articles?: GdeltRawArticle[];
}

/**
 * Normalised headline shape the UI consumes. All upstream quirks have
 * been resolved by the service layer: `seendate` is parsed into an ISO
 * timestamp, the title is trimmed, and the set is deduped by URL.
 */
export interface GdeltHeadline {
  /** Stable key — the original article URL. */
  url: string;
  /** Trimmed headline text. */
  title: string;
  /** Parsed ISO 8601 timestamp, e.g. "2026-04-15T09:15:00Z". */
  publishedAt: string;
  /** Source domain, e.g. "reuters.com". */
  domain: string;
  /** Country the source publication is attributed to by GDELT. */
  sourceCountry: string;
  /** ISO language name, e.g. "English". */
  language: string;
}

/**
 * Snapshot the service returns to the hook. Follows the same
 * Observed / curated provenance pattern aligned with the market snapshots
 * and `IceBrentSettlementSnapshot` so downstream UI can badge the
 * mode explicitly (CLAUDE.md rule #6: never hide staleness).
 */
export interface GdeltNewsSnapshot extends DataSourceMetadata {
  /** The query phrase used — surfaced to the UI for provenance. */
  query: string;
  /** Ordered most-recent-first. Always non-empty in a valid snapshot. */
  headlines: GdeltHeadline[];
}
