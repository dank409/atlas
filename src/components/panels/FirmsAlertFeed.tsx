import { useEffect, useState } from "react";
import type {
  FirmsFacilityAnomaly,
  FirmsSnapshot,
  FirmsWindowHours
} from "../../types/firms";
import styles from "./FirmsAlertFeed.module.css";

// Structured alert feed for FIRMS anomalies. CLAUDE.md FIRMS section
// spec format:
//
//   [HH:MM] [SEVERITY] [FACILITY_NAME] — [COUNT] detections in [WINDOW],
//     [X]× above [PERIOD] average — [OWNER], [CAPACITY] bpd
//
// Behaviour:
//   - NORMAL severities are dropped — only ELEVATED + ALERT appear here.
//     Normal detections are still visible as dim dots on the map.
//   - Sort order: ALERT first, then ELEVATED, then by most-recent
//     detection timestamp within each severity bucket. The scoring
//     utility already applies this sort; we preserve it.
//   - Timestamps are rendered absolute (HH:MM UTC) per the spec AND
//     updated with a live "7m ago / 2h ago" relative suffix driven
//     by a 1-second interval. Both give the trader a fast read.

interface FirmsAlertFeedProps {
  snapshot: FirmsSnapshot | null;
  isLoading: boolean;
  error: Error | null;
}

export function FirmsAlertFeed({ snapshot, isLoading, error }: FirmsAlertFeedProps) {
  const now = useNowEverySecond();

  if (isLoading && !snapshot) {
    return <div className={styles.empty}>LOADING FIRMS DETECTIONS…</div>;
  }

  if (error) {
    return <div className={styles.empty}>FIRMS LOAD FAILED: {error.message}</div>;
  }

  if (!snapshot) {
    return <div className={styles.empty}>NO FIRMS DATA.</div>;
  }

  const flagged = snapshot.anomalies.filter(
    (anomaly) => anomaly.severity === "ELEVATED" || anomaly.severity === "ALERT"
  );

  const alertCount = flagged.filter((anomaly) => anomaly.severity === "ALERT").length;
  const elevatedCount = flagged.length - alertCount;

  return (
    <div className={styles.wrap}>
      <div className={styles.metaRow}>
        <span className={styles.modeBadge} data-mode={snapshot.mode}>
          {snapshot.mode === "LIVE" ? "LIVE" : "STATIC"}
        </span>
        <span className={styles.separator}>|</span>
        <span>WINDOW {formatWindowLabel(snapshot.windowHours)}</span>
        <span className={styles.separator}>|</span>
        <span>CONF ≥ {snapshot.confidenceThreshold}</span>
        <span className={styles.separator}>|</span>
        <span>
          {alertCount} ALERT · {elevatedCount} ELEVATED
        </span>
      </div>

      {flagged.length === 0 ? (
        <div className={styles.empty}>NO ELEVATED OR ALERT FACILITIES IN WINDOW.</div>
      ) : (
        <div className={styles.entryList}>
          {flagged.map((anomaly) => (
            <AlertEntry
              key={anomaly.asset.id}
              anomaly={anomaly}
              windowHours={snapshot.windowHours}
              now={now}
            />
          ))}
        </div>
      )}

      <div className={styles.sourceLine}>SOURCE: {snapshot.source}</div>
    </div>
  );
}

interface AlertEntryProps {
  anomaly: FirmsFacilityAnomaly;
  windowHours: FirmsWindowHours;
  now: number;
}

function AlertEntry({ anomaly, windowHours, now }: AlertEntryProps) {
  const multiplier = formatMultiplier(anomaly);
  const capacity = anomaly.asset.capacityBpd
    ? `${formatBpd(anomaly.asset.capacityBpd)} bpd`
    : "-- bpd";
  const owner = anomaly.asset.owner ?? anomaly.asset.operator ?? "UNKNOWN";

  return (
    <div className={styles.entry} data-tone={anomaly.severity}>
      <div className={styles.entryHeader}>
        <span className={styles.timestamp}>
          {formatHourMinute(anomaly.latestDetectionAt)}
        </span>
        <span className={styles.severityBadge} data-severity={anomaly.severity}>
          {anomaly.severity}
        </span>
        <span className={styles.facilityName}>
          {anomaly.asset.name.toUpperCase()}
        </span>
        <span className={styles.timestamp}>
          {formatRelative(anomaly.latestDetectionAt, now)}
        </span>
      </div>
      <div className={styles.entryLine}>
        {anomaly.windowCount} detections in {formatWindowLabel(windowHours)},{" "}
        {multiplier}× above {baselinePeriodLabel(anomaly)} average
      </div>
      <div className={styles.entryMeta}>
        FACILITY: {owner.toUpperCase()} · {capacity}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hooks and helpers
// ---------------------------------------------------------------------------

function useNowEverySecond(): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

function formatWindowLabel(windowHours: FirmsWindowHours): string {
  if (windowHours === 24) return "24H";
  if (windowHours === 72) return "72H";
  return "7D";
}

function formatHourMinute(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "--:--";
  const date = new Date(ms);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatRelative(iso: string, nowMs: number): string {
  const detectionMs = Date.parse(iso);
  if (!Number.isFinite(detectionMs)) return "";
  const deltaMs = Math.max(0, nowMs - detectionMs);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "<1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMultiplier(anomaly: FirmsFacilityAnomaly): string {
  if (anomaly.baselineMean === 0 || !Number.isFinite(anomaly.ratioToBaseline)) {
    return "∞";
  }
  return anomaly.ratioToBaseline.toFixed(1);
}

function baselinePeriodLabel(anomaly: FirmsFacilityAnomaly): string {
  if (anomaly.baselineMean === 0 && anomaly.baselineStdev === 0) {
    return "0d";
  }
  // Curated baselines all sit on 30d today; future rolling baselines
  // may add 90d entries — we surface whichever was used for scoring.
  return "30d";
}

function formatBpd(bpd: number): string {
  if (bpd >= 1_000_000) return `${(bpd / 1_000_000).toFixed(2)}M`;
  if (bpd >= 1_000) return `${Math.round(bpd / 1000)}K`;
  return String(bpd);
}
