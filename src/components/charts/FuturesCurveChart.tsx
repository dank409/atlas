import { useMemo } from "react";
import type { FuturesCurveResult, FuturesCurvePoint, FuturesCurveAlpha } from "../../utils/futuresCurveModel";
import { computeFuturesCurveAlpha } from "../../utils/futuresCurveModel";
import type { IceBrentStripPoint } from "../../types/IceSettlements";
import styles from "./FuturesCurveChart.module.css";

interface FuturesCurveChartProps {
  result: FuturesCurveResult;
  /**
   * Optional observed ICE Brent forward strip. When supplied the chart
   * adds a third line (cyan) alongside the benchmark and the model
   * scenario, plus a delta/alpha readout comparing observed M1 to the
   * model-implied M1. When omitted the chart falls back to its Phase 1
   * two-line layout.
   */
  observedStrip?: IceBrentStripPoint[] | null;
  /** Mode badge for the observed strip — LIVE or STATIC_SNAPSHOT. */
  observedMode?: "LIVE" | "STATIC_SNAPSHOT" | null;
  /** As-of date of the observed strip for the source line. */
  observedAsOf?: string | null;
  /**
   * Compact mode hides the legend, alpha narrative, and source line
   * so the chart itself gets as much vertical space as possible.
   * Used by the dashboard tile; the full version renders in the
   * click-to-expand overlay.
   */
  isCompact?: boolean;
}

/**
 * Split-screen forward-curve chart: dashed-gray peacetime benchmark,
 * optional cyan observed ICE strip, and the solid amber model-implied
 * scenario curve. Pure inline SVG (no D3, no Recharts) because the
 * data shape is tiny (12 points × up to 3 series) and we want total
 * control over the terminal aesthetic — sharp corners, monospace ticks,
 * zero shadows, one-pixel strokes.
 *
 * The component is intentionally dumb. All math lives in
 * `futuresCurveModel.ts`; this file just plots what it's told. If the
 * regime label reads wrong or the spread is too tight, fix the pure
 * utility and everything downstream reflows automatically.
 */
export function FuturesCurveChart({
  result,
  observedStrip = null,
  observedMode = null,
  observedAsOf = null,
  isCompact = false
}: FuturesCurveChartProps) {
  const geometry = useMemo(
    () => computeFuturesCurveGeometry(result, observedStrip ?? null),
    [result, observedStrip]
  );
  const { plot, scenarioPath, benchmarkPath, observedPath, ticks, xLabels, promptMarker, observedMarker } = geometry;

  const alpha = useMemo<FuturesCurveAlpha | null>(() => {
    if (!observedStrip || observedStrip.length === 0) {
      return null;
    }
    const observedM1 = observedStrip.find((point) => point.month === 1)?.priceUsd;
    if (typeof observedM1 !== "number") {
      return null;
    }
    return computeFuturesCurveAlpha(result, observedM1);
  }, [observedStrip, result]);

  const regimeLabel = formatRegimeLabel(result.regime);
  const regimeTone = regimeTonePalette(result.regime);
  const spreadLabel = formatSpread(result.m1MinusM12Usd);
  const spreadTone = result.m1MinusM12Usd > 0.5 ? "red" : result.m1MinusM12Usd < -0.5 ? "green" : "muted";
  const alphaTone = alphaToneFor(alpha);

  return (
    <div className={styles.chartWrap}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <span className={styles.title}>ICE BRENT FORWARD CURVE</span>
            <span
              className={styles.regimeBadge}
              data-tone={regimeTone}
            >
              {regimeLabel}
            </span>
            {observedMode ? (
              <span
                className={styles.regimeBadge}
                data-tone={observedMode === "LIVE" ? "green" : "amber"}
              >
                {observedMode === "LIVE" ? "LIVE" : "STATIC"}
              </span>
            ) : null}
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>MODEL M1</span>
            <span className={styles.statValue}>{formatPrice(result.promptPriceUsd)}</span>
          </div>
          {alpha ? (
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>MKT M1</span>
              <span className={styles.statValue}>{formatPrice(alpha.observedM1Usd)}</span>
            </div>
          ) : (
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>M12</span>
              <span className={styles.statValue}>{formatPrice(result.longDatedPriceUsd)}</span>
            </div>
          )}
          {alpha ? (
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>ALPHA (MKT-MODEL)</span>
              <span
                className={styles.statValue}
                data-tone={alphaTone}
              >
                {formatDelta(alpha.deltaM1Usd)}
              </span>
            </div>
          ) : (
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>M1-M12</span>
              <span
                className={styles.statValue}
                data-tone={spreadTone}
              >
                {spreadLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      <svg
        aria-label="ICE Brent forward curve chart"
        className={styles.svg}
        role="img"
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        preserveAspectRatio="none"
      >
        {/* Faint horizontal gridlines aligned with y-axis ticks. Terminal
            grammar: #1a1a1a is just visible against #000. */}
        {ticks.map((tick) => (
          <line
            className={styles.gridLine}
            key={`grid-${tick.value}`}
            x1={plot.paddingLeft}
            y1={tick.y}
            x2={plot.width - plot.paddingRight}
            y2={tick.y}
          />
        ))}

        {/* Y-axis tick labels ($/bbl). */}
        {ticks.map((tick) => (
          <text
            className={styles.axisLabel}
            key={`tick-${tick.value}`}
            x={plot.paddingLeft - 6}
            y={tick.y + 3}
            textAnchor="end"
          >
            ${tick.value.toFixed(0)}
          </text>
        ))}

        {/* X-axis tick labels (M1..M12). */}
        {xLabels.map((label) => (
          <text
            className={styles.axisLabel}
            key={`xlabel-${label.month}`}
            x={label.x}
            y={plot.height - plot.paddingBottom + 14}
            textAnchor="middle"
          >
            M{label.month}
          </text>
        ))}

        {/* Static peacetime benchmark — dashed gray reference line. */}
        <path
          className={styles.benchmarkPath}
          d={benchmarkPath}
        />

        {/* Observed ICE strip — solid cyan. Rendered beneath the scenario
            so the amber line wins visual priority at crossing points. */}
        {observedPath ? (
          <path
            className={styles.observedPath}
            d={observedPath}
          />
        ) : null}

        {/* The scenario curve — thick amber. */}
        <path
          className={styles.scenarioPath}
          d={scenarioPath}
        />

        {/* Prompt-month marker dot on the scenario curve. */}
        <circle
          className={styles.promptMarker}
          cx={promptMarker.x}
          cy={promptMarker.y}
          r={3}
        />

        {/* Observed M1 marker — smaller cyan hollow dot. */}
        {observedMarker ? (
          <circle
            className={styles.observedMarker}
            cx={observedMarker.x}
            cy={observedMarker.y}
            r={3}
          />
        ) : null}
      </svg>

      {!isCompact ? (
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={`${styles.legendSwatch} ${styles.legendSwatchScenario}`} />
            <span className={styles.legendLabel}>MODEL-IMPLIED SCENARIO CURVE</span>
          </div>
          {observedPath ? (
            <div className={styles.legendRow}>
              <span className={`${styles.legendSwatch} ${styles.legendSwatchObserved}`} />
              <span className={styles.legendLabel}>OBSERVED ICE BRENT STRIP</span>
            </div>
          ) : null}
          <div className={styles.legendRow}>
            <span className={`${styles.legendSwatch} ${styles.legendSwatchBenchmark}`} />
            <span className={styles.legendLabel}>PEACETIME BENCHMARK ($80 FLAT)</span>
          </div>
        </div>
      ) : null}

      {!isCompact && alpha ? (
        <div
          className={styles.alphaNarrative}
          data-tone={alphaTone}
        >
          {alpha.narrative}
        </div>
      ) : null}

      {!isCompact ? (
        <div className={styles.sourceLine}>
          MODEL · BYPASS DTB{" "}
          {result.daysToBreach === null ? "N/A" : `${result.daysToBreach.toFixed(1)}D`}
          {observedAsOf ? ` · ICE SETTLES ${observedAsOf}` : ""}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

interface PlotDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

interface TickMark {
  value: number;
  y: number;
}

interface XLabel {
  month: number;
  x: number;
}

interface PromptMarker {
  x: number;
  y: number;
}

interface FuturesCurveGeometry {
  plot: PlotDimensions;
  scenarioPath: string;
  benchmarkPath: string;
  /** Null when no observed strip was supplied. */
  observedPath: string | null;
  ticks: TickMark[];
  xLabels: XLabel[];
  promptMarker: PromptMarker;
  observedMarker: PromptMarker | null;
}

const PLOT_DIMENSIONS: PlotDimensions = {
  width: 420,
  height: 210,
  paddingLeft: 42,
  paddingRight: 14,
  paddingTop: 18,
  paddingBottom: 26
};

/**
 * Pure function that translates the scenario result (and optional observed
 * ICE strip) into SVG path strings. Extracted so future snapshot tests can
 * assert geometry directly without rendering the component.
 *
 * The y-axis auto-range spans whichever series are present so none of the
 * three lines ever clips at the top or bottom of the plot area.
 */
export function computeFuturesCurveGeometry(
  result: FuturesCurveResult,
  observedStrip: IceBrentStripPoint[] | null = null
): FuturesCurveGeometry {
  const plot = PLOT_DIMENSIONS;
  const innerWidth = plot.width - plot.paddingLeft - plot.paddingRight;
  const innerHeight = plot.height - plot.paddingTop - plot.paddingBottom;

  // Y-axis range: include every series that exists so none clip. Pad ±5%
  // so the lines don't kiss the top/bottom of the plot area.
  const observedPrices =
    observedStrip && observedStrip.length > 0
      ? observedStrip.map((point) => point.priceUsd)
      : [];
  const allPrices = [
    ...result.curve.map((point) => point.priceUsd),
    ...result.benchmark.map((point) => point.priceUsd),
    ...observedPrices
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padSpan = Math.max(5, (maxPrice - minPrice) * 0.05);
  // Round to nearest $5 for tidy tick values.
  const yMin = roundDownTo(minPrice - padSpan, 5);
  const yMax = roundUpTo(maxPrice + padSpan, 5);

  const xForMonth = (month: number) => {
    const fraction = (month - 1) / (result.curve.length - 1);
    return plot.paddingLeft + fraction * innerWidth;
  };
  const yForPrice = (priceUsd: number) => {
    const fraction = (priceUsd - yMin) / (yMax - yMin);
    return plot.paddingTop + innerHeight - fraction * innerHeight;
  };

  const scenarioPath = buildLinePath(result.curve, xForMonth, yForPrice);
  const benchmarkPath = buildLinePath(result.benchmark, xForMonth, yForPrice);
  const observedPath =
    observedStrip && observedStrip.length > 0
      ? buildLinePath(
          observedStrip.map((point) => ({
            month: point.month,
            priceUsd: point.priceUsd
          })),
          xForMonth,
          yForPrice
        )
      : null;

  // 5 horizontal gridline ticks, rounded to $5.
  const tickCount = 5;
  const tickStep = (yMax - yMin) / (tickCount - 1);
  const ticks: TickMark[] = Array.from({ length: tickCount }, (_, index) => {
    const value = roundTo(yMin + index * tickStep, 5);
    return {
      value,
      y: yForPrice(value)
    };
  });

  // X labels: M1, M3, M6, M9, M12. Avoids clutter at 12 ticks.
  const xLabelMonths = [1, 3, 6, 9, 12];
  const xLabels: XLabel[] = xLabelMonths.map((month) => ({
    month,
    x: xForMonth(month)
  }));

  const promptMarker: PromptMarker = {
    x: xForMonth(1),
    y: yForPrice(result.curve[0].priceUsd)
  };

  const observedM1 =
    observedStrip && observedStrip.length > 0
      ? observedStrip.find((point) => point.month === 1)
      : undefined;
  const observedMarker: PromptMarker | null = observedM1
    ? {
        x: xForMonth(1),
        y: yForPrice(observedM1.priceUsd)
      }
    : null;

  return {
    plot,
    scenarioPath,
    benchmarkPath,
    observedPath,
    ticks,
    xLabels,
    promptMarker,
    observedMarker
  };
}

function buildLinePath(
  points: FuturesCurvePoint[],
  xForMonth: (month: number) => number,
  yForPrice: (priceUsd: number) => number
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xForMonth(point.month).toFixed(2)},${yForPrice(point.priceUsd).toFixed(2)}`;
    })
    .join(" ");
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function roundDownTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatSpread(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function alphaToneFor(
  alpha: FuturesCurveAlpha | null
): "red" | "green" | "muted" {
  if (!alpha) {
    return "muted";
  }
  if (alpha.classification === "ALIGNED") {
    return "muted";
  }
  // UNDERPRICED means market < model — the model thinks the paper market
  // is asleep to the deficit. Flag it red because that's the scenario a
  // trader needs to notice. OVERPRICED means market > model — trader
  // should consider taking the other side, we paint it green.
  return alpha.classification === "UNDERPRICED" ? "red" : "green";
}

function formatRegimeLabel(regime: FuturesCurveResult["regime"]): string {
  switch (regime) {
    case "EQUILIBRIUM":
      return "EQUILIBRIUM";
    case "MILD_BACKWARDATION":
      return "MILD BACKWARDATION";
    case "MODERATE_BACKWARDATION":
      return "MODERATE BACKWARDATION";
    case "SEVERE_BACKWARDATION":
      return "SEVERE BACKWARDATION";
  }
}

function regimeTonePalette(
  regime: FuturesCurveResult["regime"]
): "green" | "amber" | "red" {
  if (regime === "EQUILIBRIUM") {
    return "green";
  }
  if (regime === "SEVERE_BACKWARDATION") {
    return "red";
  }
  return "amber";
}
