import type { PricePoint } from "../../types/Market";
import styles from "./BrentSparkline.module.css";

interface BrentSparklineProps {
  ariaLabel?: string;
  color?: string;
  height?: number;
  series: PricePoint[];
  width?: number;
}

// Minimal D3-less SVG sparkline. Spec section 6.3 calls for an amber line on
// black with very subtle grid; keeping this in plain SVG means the dashboard
// panel renders fast and doesn't pull a charting library into the bundle for
// what is effectively a 30-point trend line. We can promote this to D3 if we
// ever need crosshair interaction.
export function BrentSparkline({
  ariaLabel = "BRENT 30D SPARKLINE",
  color = "#ff8c00",
  height = 120,
  series,
  width = 320
}: BrentSparklineProps) {
  if (series.length < 2) {
    return <div className={styles.empty}>INSUFFICIENT DATA</div>;
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padX = 6;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / (series.length - 1);

  const path = series
    .map((point, index) => {
      const x = padX + step * index;
      const y = padY + innerH - ((point.value - min) / range) * innerH;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `${path} L${(padX + step * (series.length - 1)).toFixed(2)},${(padY + innerH).toFixed(2)} L${padX.toFixed(2)},${(padY + innerH).toFixed(2)} Z`;
  const last = series[series.length - 1];
  const lastX = padX + step * (series.length - 1);
  const lastY = padY + innerH - ((last.value - min) / range) * innerH;

  return (
    <svg
      aria-label={ariaLabel}
      className={styles.chart}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        className={styles.gridLine}
        x1={padX}
        x2={width - padX}
        y1={padY + innerH / 2}
        y2={padY + innerH / 2}
      />
      <line
        className={styles.gridLine}
        x1={padX}
        x2={width - padX}
        y1={padY}
        y2={padY}
      />
      <line
        className={styles.gridLine}
        x1={padX}
        x2={width - padX}
        y1={padY + innerH}
        y2={padY + innerH}
      />
      <path d={areaPath} fill={color} fillOpacity={0.08} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth={1.5}
      />
      <circle cx={lastX} cy={lastY} fill={color} r={2.5} />
      <text
        className={styles.axisLabel}
        x={padX}
        y={padY - 2}
      >
        ${max.toFixed(2)}
      </text>
      <text
        className={styles.axisLabel}
        x={padX}
        y={height - 2}
      >
        ${min.toFixed(2)}
      </text>
    </svg>
  );
}
