import { useMemo } from "react";
import {
  formatCadenceLabel,
  formatClassificationLabel
} from "../../types/DataSource";
import type { EiaWeeklyInventorySnapshot } from "../../types/Market";
import styles from "./InventoryChart.module.css";

interface InventoryChartProps {
  isCompact?: boolean;
  snapshot: EiaWeeklyInventorySnapshot | null;
}

const PLOT = {
  width: 600,
  height: 220,
  paddingBottom: 28,
  paddingLeft: 42,
  paddingRight: 18,
  paddingTop: 16
};

export function InventoryChart({
  isCompact = false,
  snapshot
}: InventoryChartProps) {
  const geometry = useMemo(
    () => (snapshot ? computeInventoryGeometry(snapshot) : null),
    [snapshot]
  );

  if (!snapshot || !geometry) {
    return <div className={styles.empty}>NO WEEKLY INVENTORY DATA.</div>;
  }

  const latest = snapshot.latest;
  const rangeLabel =
    latest.rangePositionLabel === "ABOVE_RANGE"
      ? "ABOVE 5Y RANGE"
      : latest.rangePositionLabel === "BELOW_RANGE"
        ? "BELOW 5Y RANGE"
        : `${Math.round(latest.rangePosition * 100)}% OF 5Y RANGE`;
  const rangeTone =
    latest.rangePositionLabel === "ABOVE_RANGE"
      ? "amber"
      : latest.rangePositionLabel === "BELOW_RANGE"
        ? "green"
        : "white";

  return (
    <div className={styles.wrap}>
      {!isCompact ? (
        <div className={styles.header}>
          <div className={styles.title}>US CRUDE INVENTORIES</div>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statLabel}>LATEST</span>
              <span className={styles.statValue}>{latest.value.toFixed(1)} MMBBL</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>VS 5Y AVG</span>
              <span
                className={styles.statValue}
                data-tone={latest.deltaVsAverage >= 0 ? "amber" : "green"}
              >
                {latest.deltaVsAverage >= 0 ? "+" : ""}
                {latest.deltaVsAverage.toFixed(1)} MMBBL
              </span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>RANGE</span>
              <span className={styles.statValue} data-tone={rangeTone}>
                {rangeLabel}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <svg
        aria-label="US crude inventory chart"
        className={styles.svg}
        role="img"
        viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
        preserveAspectRatio="none"
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
            key={`tick-${tick.value}`}
            textAnchor="end"
            x={PLOT.paddingLeft - 6}
            y={tick.y + 3}
          >
            {tick.value.toFixed(0)}
          </text>
        ))}
        {geometry.xTicks.map((tick) => (
          <text
            className={styles.axisLabel}
            key={`xtick-${tick.label}`}
            textAnchor="middle"
            x={tick.x}
            y={PLOT.height - PLOT.paddingBottom + 14}
          >
            {tick.label}
          </text>
        ))}

        <path className={styles.bandPath} d={geometry.bandPath} />
        <path className={styles.averagePath} d={geometry.averagePath} />
        <path className={styles.inventoryPath} d={geometry.inventoryPath} />
      </svg>

      {!isCompact ? (
        <div className={styles.sourceLine}>
          {formatClassificationLabel(snapshot.classification)} |{" "}
          {formatCadenceLabel(snapshot.cadence)} | SOURCE: {snapshot.source} | AS OF{" "}
          {snapshot.asOf} | LATEST WEEK {latest.date}
        </div>
      ) : null}
    </div>
  );
}

interface GeometryTick {
  value: number;
  y: number;
}

interface XTick {
  label: string;
  x: number;
}

interface InventoryGeometry {
  averagePath: string;
  bandPath: string;
  inventoryPath: string;
  xTicks: XTick[];
  yTicks: GeometryTick[];
}

function computeInventoryGeometry(
  snapshot: EiaWeeklyInventorySnapshot
): InventoryGeometry | null {
  if (snapshot.series.length < 2) {
    return null;
  }

  const values = snapshot.series.flatMap((point) => [
    point.value,
    point.fiveYearAverage,
    point.fiveYearMin,
    point.fiveYearMax
  ]);
  const yMin = Math.floor((Math.min(...values) - 8) / 10) * 10;
  const yMax = Math.ceil((Math.max(...values) + 8) / 10) * 10;
  const innerWidth = PLOT.width - PLOT.paddingLeft - PLOT.paddingRight;
  const innerHeight = PLOT.height - PLOT.paddingTop - PLOT.paddingBottom;

  const xForIndex = (index: number) =>
    PLOT.paddingLeft + (index / Math.max(snapshot.series.length - 1, 1)) * innerWidth;
  const yForValue = (value: number) =>
    PLOT.paddingTop + innerHeight - ((value - yMin) / Math.max(yMax - yMin, 1)) * innerHeight;

  const inventoryPath = snapshot.series
    .map((point, index) => {
      const x = xForIndex(index);
      const y = yForValue(point.value);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const averagePath = snapshot.series
    .map((point, index) => {
      const x = xForIndex(index);
      const y = yForValue(point.fiveYearAverage);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const upper = snapshot.series.map((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(point.fiveYearMax);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const lower = [...snapshot.series]
    .reverse()
    .map((point, reverseIndex) => {
      const index = snapshot.series.length - 1 - reverseIndex;
      const x = xForIndex(index);
      const y = yForValue(point.fiveYearMin);
      return `L${x.toFixed(2)},${y.toFixed(2)}`;
    });

  const bandPath = `${upper.join(" ")} ${lower.join(" ")} Z`;

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = yMin + ((yMax - yMin) / 4) * index;
    return {
      value,
      y: yForValue(value)
    };
  });

  const xTicks = snapshot.series
    .filter((_, index) => index % Math.max(Math.floor(snapshot.series.length / 4), 1) === 0)
    .map((point, index, ticks) => ({
      label: point.date.slice(5),
      x:
        ticks.length === 1
          ? xForIndex(0)
          : xForIndex(
              snapshot.series.findIndex((candidate) => candidate.date === point.date)
            )
    }));

  return {
    averagePath,
    bandPath,
    inventoryPath,
    xTicks,
    yTicks
  };
}
