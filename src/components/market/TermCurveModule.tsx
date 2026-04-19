import { Panel } from "../common/Panel";
import type { IceBrentSettlementSnapshot } from "../../types/IceSettlements";
import type { BrentTimespreadSnapshot } from "../../types/Market";
import styles from "./TermCurveModule.module.css";

interface TermCurveModuleProps {
  snapshot: IceBrentSettlementSnapshot | null;
  timespreads: BrentTimespreadSnapshot | null;
}

// SVG constants — the curve is drawn in a fixed 240x72 viewBox so the
// grid, points, and labels are pixel-deterministic. The outer svg
// width is 100% so the curve resizes with the panel, but internal
// padding and font sizes stay readable at any container width.
const SVG_WIDTH = 240;
const SVG_HEIGHT = 72;
const PAD_X = 6;
const PAD_Y = 6;

/**
 * ICE Brent forward strip (M1–M12). Single settlement-date curve, not
 * a time series. When it slopes down it's backwardation (supply tight
 * now, discounted later) — the label reflects the snapshot's
 * classification from useIceSettlements.timespreads.
 */
export function TermCurveModule({ snapshot, timespreads }: TermCurveModuleProps) {
  if (!snapshot || snapshot.strip.length === 0) {
    return (
      <Panel title="TERM STRUCTURE" badge="M1 → M12">
        <div className={styles.empty}>NO SETTLEMENT DATA</div>
      </Panel>
    );
  }

  const strip = snapshot.strip;
  const values = strip.map((p) => p.priceUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = SVG_WIDTH - PAD_X * 2;
  const innerH = SVG_HEIGHT - PAD_Y * 2 - 8; // leave 8px for bottom labels
  const step = innerW / (strip.length - 1);

  const points = strip.map((p, i) => {
    const x = PAD_X + step * i;
    const y = PAD_Y + innerH - ((p.priceUsd - min) / range) * innerH;
    return { x, y, month: p.month, price: p.priceUsd };
  });

  const path = points
    .map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const structureLabel = timespreads?.structure ?? "";
  const structureClass = structureLabel === "BACKWARDATION"
    ? styles.structurePos
    : structureLabel === "CONTANGO"
      ? styles.structureNeg
      : styles.structureNeutral;

  return (
    <Panel title="TERM STRUCTURE" badge="M1 → M12">
      <svg
        aria-label="ICE BRENT M1-M12 SETTLEMENT CURVE"
        className={styles.chart}
        role="img"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      >
        {/* grid baseline + midline */}
        <line
          className={styles.grid}
          x1={PAD_X}
          x2={SVG_WIDTH - PAD_X}
          y1={PAD_Y}
          y2={PAD_Y}
        />
        <line
          className={styles.grid}
          x1={PAD_X}
          x2={SVG_WIDTH - PAD_X}
          y1={PAD_Y + innerH / 2}
          y2={PAD_Y + innerH / 2}
        />
        <line
          className={styles.grid}
          x1={PAD_X}
          x2={SVG_WIDTH - PAD_X}
          y1={PAD_Y + innerH}
          y2={PAD_Y + innerH}
        />
        {/* curve */}
        <path className={styles.curve} d={path} />
        {/* points */}
        {points.map((p) => (
          <circle
            className={styles.dot}
            cx={p.x}
            cy={p.y}
            key={p.month}
            r={1.5}
          />
        ))}
        {/* month labels on every third tick so we don't clutter */}
        {points
          .filter((_, i) => i === 0 || i === points.length - 1 || i % 3 === 0)
          .map((p) => (
            <text
              className={styles.monthLabel}
              key={`lbl-${p.month}`}
              textAnchor="middle"
              x={p.x}
              y={SVG_HEIGHT - 1}
            >
              M{p.month}
            </text>
          ))}
      </svg>
      <div className={styles.footer}>
        <span className={styles.footerItem}>
          <span className={styles.swatch} />
          BRENT
        </span>
        <span className={styles.range}>
          {min.toFixed(2)} — {max.toFixed(2)}
        </span>
        {structureLabel ? (
          <span className={`${styles.structure} ${structureClass}`}>{structureLabel}</span>
        ) : null}
      </div>
    </Panel>
  );
}
