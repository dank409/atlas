import type { GdeltNewsSnapshot } from "../../types/Gdelt";
import styles from "./NewsTicker.module.css";

interface NewsTickerProps {
  snapshot: GdeltNewsSnapshot | null;
  isLoading: boolean;
  error: Error | null;
}

const MAX_HEADLINES = 8;

/**
 * Compact terminal-style news strip. Renders a capped list of the
 * most-recent GDELT headlines tied to the Hormuz / Gulf energy
 * narrative. Every row is a single-line link with a relative
 * timestamp so the user can scan the feed without breaking their
 * attention from the map or scenario modeler.
 *
 * Clicking a headline opens the source article in a new tab. We do
 * not embed the source HTML or strip attribution — the domain and
 * source country are always rendered so the user knows who wrote it.
 */
export function NewsTicker({ snapshot, isLoading, error }: NewsTickerProps) {
  if (isLoading && !snapshot) {
    return (
      <div className={styles.placeholder}>FETCHING GDELT HEADLINES...</div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className={styles.placeholder}>
        GDELT FEED UNAVAILABLE. CHECK NETWORK OR RATE LIMIT.
      </div>
    );
  }

  if (!snapshot || snapshot.headlines.length === 0) {
    return (
      <div className={styles.placeholder}>
        NO HEADLINES IN WINDOW. QUERY: {snapshot?.query ?? "--"}
      </div>
    );
  }

  const headlines = snapshot.headlines.slice(0, MAX_HEADLINES);

  return (
    <div className={styles.ticker}>
      <ul className={styles.list}>
        {headlines.map((headline) => (
          <li className={styles.row} key={headline.url}>
            <span className={styles.time}>
              {formatRelativeTime(headline.publishedAt)}
            </span>
            <a
              className={styles.headline}
              href={headline.url}
              rel="noreferrer noopener"
              target="_blank"
              title={headline.title}
            >
              {headline.title}
            </a>
            <span className={styles.meta}>
              {headline.domain}
              {headline.sourceCountry ? ` · ${headline.sourceCountry}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.sourceLine}>
        SOURCE: {snapshot.source} | QUERY: {snapshot.query}
      </div>
    </div>
  );
}

/**
 * Renders a relative-time label like "7M AGO" / "3H AGO" / "2D AGO"
 * from an ISO timestamp. Falls back to the raw date chunk if the
 * timestamp can't be parsed. Keeps the output uppercase to match
 * the rest of the terminal label vocabulary.
 *
 * Exported for testing.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  if (!iso) {
    return "--";
  }

  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso.slice(0, 10).toUpperCase();
  }

  const deltaMs = now.getTime() - parsed;
  if (deltaMs < 0) {
    return "JUST NOW";
  }

  const deltaMinutes = Math.floor(deltaMs / 60_000);
  if (deltaMinutes < 1) {
    return "JUST NOW";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}M AGO`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 48) {
    return `${deltaHours}H AGO`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}D AGO`;
}
