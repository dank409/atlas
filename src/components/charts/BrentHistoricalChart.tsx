import { useMemo, useState } from "react";
import type { PricePoint } from "../../types/Market";
import type { OutageEvent, OutageSeverity } from "../../types/outageEvent";
import styles from "./BrentHistoricalChart.module.css";

// Multi-year Brent line chart with curated outage-event overlays. Pure
// SVG (no D3, no Recharts) — same convention as FuturesCurveChart.tsx.
// Axis/line geometry is computed by a pure function so future tests can
// assert paths without rendering. The chart is "dumb": parent passes a
// series + events + the selected window, component plots.

export type BrentHistoricalWindow = "1Y" | "2Y" | "5Y" | "MAX";

interface BrentHistoricalChartProps {
  series: PricePoint[];
  events: OutageEvent[];
  asOf?: string | null;
  source?: string | null;
  /**
   * Compact mode hides the window buttons, events toggle, and
   * source line so the chart itself gets maximum vertical space.
   * Used by the dashboard tile; the full interactive version
   * renders in the click-to-expand overlay.
   */
  isCompact?: boolean;
}

const PLOT = {
  width: 600,
  height: 220,
  paddingLeft: 44,
  paddingRight: 16,
  paddingTop: 16,
  paddingBottom: 28
};

const WINDOW_DAYS: Record<BrentHistoricalWindow, number | null> = {
  "1Y": 365,
  "2Y": 730,
  "5Y": 365 * 5,
  MAX: null
};

export function BrentHistoricalChart({
  series,
  events,
  asOf,
  source,
  isCompact = false
}: BrentHistoricalChartProps) {
  const [windowMode, setWindowMode] = useState<BrentHistoricalWindow>("5Y");
  const [showEvents, setShowEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const geometry = useMemo(
    () => computeChartGeometry(series, events, windowMode),
    [series, events, windowMode]
  );

  if (!geometry) {
    return <div className={styles.empty}>NO BRENT HISTORICAL DATA.</div>;
  }

  const selectedEvent =
    selectedEventId !== null
      ? events.find((event) => event.id === selectedEventId) ?? null
      : null;

  return (
    <div className={styles.wrap}>
      {!isCompact ? (
        <div className={styles.header}>
          <span className={styles.title}>BRENT HISTORICAL · EVENT OVERLAY</span>
          <div className={styles.controls}>
            {(Object.keys(WINDOW_DAYS) as BrentHistoricalWindow[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={
                  mode === windowMode ? styles.controlButtonActive : styles.controlButton
                }
                onClick={() => {
                  setWindowMode(mode);
                  setSelectedEventId(null);
                }}
              >
                {mode}
              </button>
            ))}
            <button
              type="button"
              className={showEvents ? styles.eventsToggleActive : styles.eventsToggle}
              onClick={() => {
                setShowEvents((current) => !current);
                setSelectedEventId(null);
              }}
              aria-pressed={showEvents}
            >
              EVENTS {showEvents ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.chartArea}>
        <svg
          aria-label="Brent historical chart with outage event overlay"
          className={styles.svg}
          role="img"
          viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
          preserveAspectRatio="none"
          onClick={() => setSelectedEventId(null)}
        >
          {geometry.yTicks.map((tick) => (
            <line
              className={styles.gridLine}
              key={`grid-${tick.value}`}
              x1={PLOT.paddingLeft}
              x2={PLOT.width - PLOT.paddingRight}
              y1={tick.y}
              y2={tick.y}
            />
          ))}

          {geometry.yTicks.map((tick) => (
            <text
              className={styles.axisLabel}
              key={`ytick-${tick.value}`}
              x={PLOT.paddingLeft - 6}
              y={tick.y + 3}
              textAnchor="end"
            >
              ${tick.value.toFixed(0)}
            </text>
          ))}

          {geometry.xTicks.map((tick) => (
            <text
              className={styles.axisLabel}
              key={`xtick-${tick.year}`}
              x={tick.x}
              y={PLOT.height - PLOT.paddingBottom + 14}
              textAnchor="middle"
            >
              {tick.year}
            </text>
          ))}

          <path className={styles.pricePath} d={geometry.pricePath} />

          {showEvents
            ? geometry.eventLines.map((line) => (
                <line
                  key={line.id}
                  data-event-rule="true"
                  data-event-id={line.id}
                  data-severity={line.severity}
                  className={severityClass(line.severity)}
                  x1={line.x}
                  x2={line.x}
                  y1={PLOT.paddingTop}
                  y2={PLOT.height - PLOT.paddingBottom}
                  onClick={(native) => {
                    native.stopPropagation();
                    setSelectedEventId(line.id);
                  }}
                />
              ))
            : null}
        </svg>

        {selectedEvent ? (
          <EventTooltip event={selectedEvent} />
        ) : null}
      </div>

      {!isCompact ? (
        <div className={styles.sourceLine}>
          SOURCE: {source ?? "--"} · AS OF {asOf ?? "--"} · WINDOW {windowMode} ·{" "}
          {geometry.eventLines.length} EVENT
          {geometry.eventLines.length === 1 ? "" : "S"} IN WINDOW
        </div>
      ) : null}
    </div>
  );
}

function severityClass(severity: OutageSeverity): string {
  if (severity === "CRITICAL") {
    return styles.eventLineCritical;
  }
  if (severity === "HIGH") {
    return styles.eventLineHigh;
  }
  if (severity === "MEDIUM") {
    return styles.eventLineMedium;
  }
  return styles.eventLineLow;
}

function EventTooltip({ event }: { event: OutageEvent }) {
  return (
    <div className={styles.tooltip} role="dialog" aria-label="Event detail">
      <div className={styles.tooltipHeader}>{event.name}</div>
      <div className={styles.tooltipRow}>
        <span>DATE</span>
        <span>{event.date}</span>
      </div>
      <div className={styles.tooltipRow}>
        <span>COUNTRY</span>
        <span>{event.country}</span>
      </div>
      <div className={styles.tooltipRow}>
        <span>SEVERITY</span>
        <span
          className={styles.severityBadge}
          data-severity={event.severity}
        >
          {event.severity}
        </span>
      </div>
      <div className={styles.tooltipRow}>
        <span>CATEGORY</span>
        <span>{event.category.toUpperCase()}</span>
      </div>
      {event.outageVolumeBpd > 0 ? (
        <div className={styles.tooltipRow}>
          <span>VOLUME</span>
          <span>{formatVolume(event.outageVolumeBpd)}</span>
        </div>
      ) : null}
      {event.priceReaction ? (
        <div className={styles.tooltipRow}>
          <span>BRENT {event.priceReaction.windowHours}H</span>
          <span>
            {event.priceReaction.brentChangePct >= 0 ? "+" : ""}
            {event.priceReaction.brentChangePct.toFixed(2)}%
          </span>
        </div>
      ) : null}
      <div className={styles.tooltipSummary}>{event.summary}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geometry — pure
// ---------------------------------------------------------------------------

interface YTick {
  value: number;
  y: number;
}

interface XTick {
  year: number;
  x: number;
}

interface EventLine {
  id: string;
  x: number;
  severity: OutageSeverity;
}

interface ChartGeometry {
  pricePath: string;
  yTicks: YTick[];
  xTicks: XTick[];
  eventLines: EventLine[];
  windowStart: string;
  windowEnd: string;
}

export function computeChartGeometry(
  series: PricePoint[],
  events: OutageEvent[],
  windowMode: BrentHistoricalWindow
): ChartGeometry | null {
  if (!series.length) {
    return null;
  }

  // Slice the window relative to the last point in the series.
  const lastIso = series[series.length - 1].date;
  const lastMs = Date.parse(lastIso);
  const windowDays = WINDOW_DAYS[windowMode];
  const startMs =
    windowDays === null ? Date.parse(series[0].date) : lastMs - windowDays * 86_400_000;

  const windowed = series.filter((point) => Date.parse(point.date) >= startMs);

  if (windowed.length < 2) {
    return null;
  }

  const firstMs = Date.parse(windowed[0].date);
  const spanMs = lastMs - firstMs;
  const innerWidth = PLOT.width - PLOT.paddingLeft - PLOT.paddingRight;
  const innerHeight = PLOT.height - PLOT.paddingTop - PLOT.paddingBottom;

  const values = windowed.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padSpan = Math.max(5, (maxValue - minValue) * 0.08);
  const yMin = roundDownTo(minValue - padSpan, 10);
  const yMax = roundUpTo(maxValue + padSpan, 10);

  const xForMs = (ms: number) =>
    PLOT.paddingLeft + ((ms - firstMs) / Math.max(spanMs, 1)) * innerWidth;
  const yForValue = (value: number) =>
    PLOT.paddingTop + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;

  const pricePath = windowed
    .map((point, index) => {
      const x = xForMs(Date.parse(point.date));
      const y = yForValue(point.value);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const yTickCount = 5;
  const yTickStep = (yMax - yMin) / (yTickCount - 1);
  const yTicks: YTick[] = Array.from({ length: yTickCount }, (_, index) => {
    const value = Math.round(yMin + yTickStep * index);
    return { value, y: yForValue(value) };
  });

  // X ticks: evenly-spaced year labels across the window.
  const firstYear = new Date(firstMs).getUTCFullYear();
  const lastYear = new Date(lastMs).getUTCFullYear();
  const yearSpan = lastYear - firstYear;
  const maxTicks = 6;
  const yearStep = Math.max(1, Math.ceil((yearSpan + 1) / maxTicks));
  const xTicks: XTick[] = [];
  for (let year = firstYear; year <= lastYear; year += yearStep) {
    const jan1Ms = Date.UTC(year, 0, 1);
    if (jan1Ms < firstMs || jan1Ms > lastMs) {
      continue;
    }
    xTicks.push({ year, x: xForMs(jan1Ms) });
  }
  // Always include the final year if it's not already there.
  if (xTicks.length === 0 || xTicks[xTicks.length - 1].year !== lastYear) {
    xTicks.push({ year: lastYear, x: xForMs(lastMs) });
  }

  const eventLines: EventLine[] = events
    .filter((event) => {
      const eventMs = Date.parse(event.date);
      return eventMs >= firstMs && eventMs <= lastMs;
    })
    .map((event) => ({
      id: event.id,
      severity: event.severity,
      x: xForMs(Date.parse(event.date))
    }));

  return {
    pricePath,
    yTicks,
    xTicks,
    eventLines,
    windowStart: windowed[0].date,
    windowEnd: windowed[windowed.length - 1].date
  };
}

function formatVolume(bpd: number): string {
  if (bpd >= 1_000_000) {
    return `${(bpd / 1_000_000).toFixed(2)} mbpd`;
  }
  return `${(bpd / 1000).toFixed(0)} kbpd`;
}

function roundDownTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}
