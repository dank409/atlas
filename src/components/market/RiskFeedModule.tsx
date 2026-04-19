import { Panel } from "../common/Panel";
import type { FirmsFacilityAnomaly } from "../../types/firms";
import type { OutageEvent, OutageSeverity } from "../../types/outageEvent";
import styles from "./RiskFeedModule.module.css";

interface RiskFeedModuleProps {
  outageEvents: OutageEvent[];
  firmsAnomalies: FirmsFacilityAnomaly[];
  /** Cap on items shown in the feed. Defaults to 8 to keep the panel dense. */
  limit?: number;
}

type FeedSeverity = "HIGH" | "MED" | "LOW";

interface FeedEntry {
  key: string;
  timestamp: string;
  severity: FeedSeverity;
  location: string;
  summary: string;
  tags: string[];
  source: "OUTAGE" | "FIRMS";
  /** ISO date used for sort — not displayed. */
  sortKey: string;
}

/**
 * Unified risk feed: merges curated outage events with live FIRMS
 * facility anomalies into a single chronologically-ordered stream.
 * FIRMS anomalies at ELEVATED/ALERT severity show up immediately;
 * NORMAL-tier matches are filtered out (they're infrastructure noise).
 */
export function RiskFeedModule({
  outageEvents,
  firmsAnomalies,
  limit = 8
}: RiskFeedModuleProps) {
  const outageEntries: FeedEntry[] = outageEvents.map((event) => ({
    key: `outage-${event.id}`,
    timestamp: formatDate(event.date),
    severity: mapOutageSeverity(event.severity),
    location: event.country,
    summary: event.summary || event.name,
    tags: [event.category.toUpperCase(), event.resolved ? "RESOLVED" : "ONGOING"],
    source: "OUTAGE",
    sortKey: event.date
  }));

  const firmsEntries: FeedEntry[] = firmsAnomalies
    .filter((anomaly) => anomaly.severity !== "NORMAL")
    .map((anomaly) => ({
      key: `firms-${anomaly.asset.id}`,
      timestamp: formatDate(anomaly.latestDetectionAt),
      severity: anomaly.severity === "ALERT" ? "HIGH" : "MED",
      location: anomaly.asset.name,
      summary: `${anomaly.windowCount} detections in window · ${anomaly.ratioToBaseline.toFixed(1)}× baseline`,
      tags: ["FIRMS", anomaly.asset.assetType.toUpperCase()],
      source: "FIRMS",
      sortKey: anomaly.latestDetectionAt
    }));

  const entries = [...outageEntries, ...firmsEntries]
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .slice(0, limit);

  const badge = `${entries.length} · 24H`;

  return (
    <Panel title="RISK · EVENT FEED" badge={badge}>
      {entries.length === 0 ? (
        <div className={styles.empty}>NO EVENTS</div>
      ) : (
        <div className={styles.list}>
          {entries.map((entry) => (
            <FeedItem entry={entry} key={entry.key} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function FeedItem({ entry }: { entry: FeedEntry }) {
  const sevClass =
    entry.severity === "HIGH"
      ? styles.sevHigh
      : entry.severity === "MED"
        ? styles.sevMed
        : styles.sevLow;
  return (
    <div className={styles.item}>
      <span className={`${styles.sevDot} ${sevClass}`} />
      <span className={styles.timestamp}>{entry.timestamp}</span>
      <div className={styles.body}>
        <div className={`${styles.header} ${sevClass}`}>
          {entry.severity} · {entry.location}
        </div>
        <div className={styles.summary}>{entry.summary}</div>
        {entry.tags.length > 0 ? (
          <div className={styles.tags}>
            {entry.tags.map((tag) => (
              <span className={styles.tag} key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function mapOutageSeverity(severity: OutageSeverity): FeedSeverity {
  if (severity === "CRITICAL" || severity === "HIGH") return "HIGH";
  if (severity === "MEDIUM") return "MED";
  return "LOW";
}

function formatDate(iso: string): string {
  // Short date in YYYY-MM-DD → MM-DD form to stay compact in the feed.
  if (!iso) return "--";
  const slice = iso.slice(5, 10);
  return slice || iso.slice(0, 10);
}
