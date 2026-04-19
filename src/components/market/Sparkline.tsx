import styles from "./Sparkline.module.css";

interface SparklineProps {
  /**
   * Numeric series. A straight-line or empty series renders as a flat
   * zero-baseline — the consumer should fall back to `--` when data is
   * missing instead of passing `[]` into this component.
   */
  series: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  ariaLabel?: string;
}

/**
 * Tiny inline SVG sparkline for dense stacked modules. No axes, no
 * labels, no grid — just a polyline with an optional filled area. Use
 * this for in-row sparklines (PriceGrid) where `BrentSparkline`'s
 * axis-labelled variant is too heavy. Rendering is pure SVG so we
 * don't pull a charting library into the bundle for a 30-point trend.
 */
export function Sparkline({
  series,
  color = "#ff8c00",
  width = 80,
  height = 18,
  fill = true,
  ariaLabel
}: SparklineProps) {
  if (series.length < 2) {
    return (
      <svg
        aria-label={ariaLabel ?? "INSUFFICIENT DATA"}
        className={styles.chart}
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      />
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const step = width / (series.length - 1);

  const points = series.map((value, index) => {
    const x = step * index;
    const y = height - ((value - min) / range) * height;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${path} L ${width.toFixed(1)} ${height.toFixed(1)} L 0 ${height.toFixed(1)} Z`;

  return (
    <svg
      aria-label={ariaLabel ?? "SPARKLINE"}
      className={styles.chart}
      height={height}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {fill ? <path className={styles.area} d={areaPath} fill={color} /> : null}
      <path className={styles.line} d={path} stroke={color} />
    </svg>
  );
}
