import { useRef } from "react";
import type { PricePoint } from "../../types/Market";
import type { OutageEvent } from "../../types/outageEvent";
import styles from "./TimelineScrubber.module.css";

interface TimelineScrubberProps {
  /** Brent historical series (weekly or daily). Must span the window. */
  brentSeries: PricePoint[];
  /** Outage events to render as dated vertical markers. */
  outageEvents: OutageEvent[];
  /**
   * Window expressed as number of days back from the most recent point.
   * Defaults to 90. Ignored when the series is shorter than this.
   */
  windowDays?: number;
  /**
   * Playhead position as a fraction of the window [0, 1]. 1 = NOW,
   * 0 = `windowDays` ago. Optional — when omitted the playhead sits
   * at the right edge and the scrubber behaves as a read-only view.
   */
  timeT?: number;
  /**
   * Fires when the user clicks the scrubber track. Receives the
   * fractional [0, 1] position. Parent is responsible for persisting
   * the value and feeding it back through `timeT` on re-render.
   */
  onScrub?: (t: number) => void;
}

// Fixed SVG viewBox — the scrubber scales to its container width but
// internal geometry stays pixel-deterministic so event markers don't
// drift relative to the sparkline at different screen widths.
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 34;

/**
 * Non-interactive timeline surface for the footer gutter. Plots a
 * Brent spot trace over the window and overlays severity-coloured
 * vertical rules for each outage event that falls inside the window.
 * The rightmost edge is "NOW" — there's no playhead because we don't
 * yet have time-travel bindings for the rest of the app. The visual
 * ties market moves to the physical event log, which is the P0 #14
 * requirement from CLAUDE.md.
 */
export function TimelineScrubber({
  brentSeries,
  outageEvents,
  windowDays = 90,
  timeT,
  onScrub
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  if (brentSeries.length < 2) {
    return (
      <div className={styles.scrubber}>
        <div className={styles.empty}>BRENT HISTORICAL · LOADING</div>
      </div>
    );
  }

  const sorted = [...brentSeries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const latestMs = parseIsoDate(latest.date);
  const startMs = latestMs - windowDays * MS_PER_DAY;
  const window = sorted.filter((p) => parseIsoDate(p.date) >= startMs);

  if (window.length < 2) {
    return (
      <div className={styles.scrubber}>
        <div className={styles.empty}>BRENT HISTORICAL · LOADING</div>
      </div>
    );
  }

  const values = window.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xAt = (date: string) => {
    const t = parseIsoDate(date);
    const pct = (t - startMs) / (latestMs - startMs || 1);
    return Math.max(0, Math.min(1, pct)) * SVG_WIDTH;
  };
  const yAt = (value: number) => SVG_HEIGHT - ((value - min) / range) * SVG_HEIGHT;

  const path = window
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.date).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`;

  const markers = outageEvents
    .map((event) => {
      const t = parseIsoDate(event.date);
      if (t < startMs || t > latestMs) return null;
      const x = xAt(event.date);
      return {
        id: event.id,
        x,
        severity: event.severity,
        name: event.name,
        date: event.date.slice(0, 10)
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const latestBrent = latest.value.toFixed(2);
  const clampedT = typeof timeT === "number" ? Math.max(0, Math.min(1, timeT)) : 1;
  const playheadMs = startMs + (latestMs - startMs) * clampedT;
  const playheadDate = new Date(playheadMs).toISOString().slice(0, 10);
  const isRewound = clampedT < 0.999;

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onScrub || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const t = (event.clientX - rect.left) / rect.width;
    onScrub(Math.max(0, Math.min(1, t)));
  };

  return (
    <div className={styles.scrubber}>
      <div className={styles.header}>
        <span className={styles.label}>TIMELINE · {windowDays}D</span>
        {isRewound ? (
          <>
            <span className={styles.rewoundBadge}>T= {playheadDate}</span>
            {onScrub ? (
              <button
                className={styles.resetButton}
                onClick={() => onScrub(1)}
                type="button"
              >
                RESET → NOW
              </button>
            ) : null}
          </>
        ) : null}
        <span className={styles.spacer} />
        <span className={styles.brent}>BRENT</span>
        <span className={styles.brentValue}>${latestBrent}</span>
        <span className={isRewound ? styles.nowBadgeRewound : styles.nowBadge}>NOW</span>
      </div>
      <div
        aria-label="Timeline scrubber track"
        className={onScrub ? styles.trackInteractive : styles.track}
        onClick={handleTrackClick}
        ref={trackRef}
        role={onScrub ? "slider" : undefined}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={clampedT}
      >
        <svg
          aria-label={`BRENT ${windowDays}D WITH OUTAGE EVENT OVERLAY`}
          className={styles.chart}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        >
          <path className={styles.area} d={areaPath} />
          <path className={styles.line} d={path} />
          {markers.map((m) => (
            <line
              className={`${styles.marker} ${severityClass(m.severity, styles)}`}
              key={m.id}
              x1={m.x}
              x2={m.x}
              y1={0}
              y2={SVG_HEIGHT}
            >
              <title>{`${m.date} · ${m.severity} · ${m.name}`}</title>
            </line>
          ))}
          {/* Playhead — always visible, highlighted when rewound. */}
          <line
            className={isRewound ? styles.playheadRewound : styles.playhead}
            x1={clampedT * SVG_WIDTH}
            x2={clampedT * SVG_WIDTH}
            y1={0}
            y2={SVG_HEIGHT}
          />
        </svg>
      </div>
    </div>
  );
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string): number {
  // Forgiving parse — missing time component is treated as midnight UTC.
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(t) ? 0 : t;
}

function severityClass(
  severity: OutageEvent["severity"],
  stylesMap: Record<string, string>
): string {
  if (severity === "CRITICAL" || severity === "HIGH") return stylesMap.markerHigh;
  if (severity === "MEDIUM") return stylesMap.markerMed;
  return stylesMap.markerLow;
}
