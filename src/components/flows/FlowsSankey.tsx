import { useMemo } from "react";
import type { FlowSnapshot } from "../../types/Flows";
import styles from "./FlowsSankey.module.css";

interface FlowsSankeyProps {
  snapshot: FlowSnapshot;
  width?: number;
  height?: number;
}

// Fixed layout constants. The 3-column Sankey is a custom renderer
// (not d3-sankey) so we stay off an extra ~30 kB dep. Columns:
//   origin    →  chokepoint    →  destination
const COL_X_LEFT = 120;
const COL_X_MID = 520;
const COL_X_RIGHT = 900;
const NODE_WIDTH = 12;
const NODE_GAP = 6;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 24;

interface LaidOutNode {
  id: string;
  label: string;
  col: "origin" | "chokepoint" | "destination";
  x: number;
  y: number;
  height: number;
  totalMbpd: number;
}

interface Ribbon {
  id: string;
  path: string;
  mbpd: number;
  originId: string;
  chokepointId: string;
  destinationId: string;
}

/**
 * Custom-rendered 3-column Sankey: origin → chokepoint → destination.
 * Ribbon widths are proportional to mbpd. The layout algorithm is a
 * two-pass stack: (1) sum each node's mbpd, (2) allocate vertical
 * space proportionally within each column with a uniform node gap.
 * Ribbons are drawn as cubic Béziers between the outgoing slice of
 * the origin and the incoming slice of the target.
 */
export function FlowsSankey({ snapshot, width = 1020, height = 480 }: FlowsSankeyProps) {
  const { nodes, ribbons, totalMbpd } = useMemo(
    () => layoutSankey(snapshot, height),
    [snapshot, height]
  );

  if (nodes.length === 0) {
    return <div className={styles.empty}>NO FLOW DATA</div>;
  }

  return (
    <svg
      aria-label="Crude flow Sankey · origin → chokepoint → destination"
      className={styles.chart}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {ribbons.map((ribbon) => (
        <path
          className={styles.ribbon}
          d={ribbon.path}
          key={ribbon.id}
          strokeWidth={Math.max(1, (ribbon.mbpd / (totalMbpd || 1)) * height)}
        >
          <title>{`${ribbon.originId} → ${ribbon.chokepointId} → ${ribbon.destinationId}: ${ribbon.mbpd.toFixed(2)} mbpd`}</title>
        </path>
      ))}
      {nodes.map((node) => (
        <g key={`${node.col}-${node.id}`}>
          <rect
            className={
              node.col === "chokepoint"
                ? styles.nodeChoke
                : node.col === "origin"
                  ? styles.nodeOrigin
                  : styles.nodeDestination
            }
            height={node.height}
            width={NODE_WIDTH}
            x={node.x}
            y={node.y}
          />
          <text
            className={
              node.col === "destination"
                ? styles.nodeLabelRight
                : node.col === "origin"
                  ? styles.nodeLabelLeft
                  : styles.nodeLabelMid
            }
            x={labelX(node)}
            y={node.y + node.height / 2 + 3}
          >
            {node.label}
          </text>
          <text
            className={styles.nodeValue}
            x={labelX(node)}
            y={node.y + node.height / 2 + 14}
          >
            {node.totalMbpd.toFixed(1)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function labelX(node: LaidOutNode): number {
  if (node.col === "origin") return node.x - 8;
  if (node.col === "destination") return node.x + NODE_WIDTH + 8;
  return node.x + NODE_WIDTH + 8;
}

interface LayoutResult {
  nodes: LaidOutNode[];
  ribbons: Ribbon[];
  totalMbpd: number;
}

function layoutSankey(snapshot: FlowSnapshot, height: number): LayoutResult {
  const usableHeight = height - PADDING_TOP - PADDING_BOTTOM;

  // Aggregate flow per node by summing over the legs.
  const originTotals = new Map<string, number>();
  const chokeTotals = new Map<string, number>();
  const destTotals = new Map<string, number>();

  for (const leg of snapshot.legs) {
    originTotals.set(leg.origin, (originTotals.get(leg.origin) ?? 0) + leg.mbpd);
    chokeTotals.set(leg.chokepoint, (chokeTotals.get(leg.chokepoint) ?? 0) + leg.mbpd);
    destTotals.set(leg.destination, (destTotals.get(leg.destination) ?? 0) + leg.mbpd);
  }

  const totalMbpd = snapshot.legs.reduce((acc, leg) => acc + leg.mbpd, 0);

  // Turn each column's node list into stacked positions.
  const originNodes = stackColumn(
    snapshot.origins,
    originTotals,
    "origin",
    COL_X_LEFT,
    usableHeight,
    PADDING_TOP
  );
  const chokepointNodes = stackColumn(
    snapshot.chokepoints,
    chokeTotals,
    "chokepoint",
    COL_X_MID,
    usableHeight,
    PADDING_TOP
  );
  const destinationNodes = stackColumn(
    snapshot.destinations,
    destTotals,
    "destination",
    COL_X_RIGHT,
    usableHeight,
    PADDING_TOP
  );

  const nodes = [...originNodes, ...chokepointNodes, ...destinationNodes];

  // Track per-node consumed slice offsets so each ribbon starts at
  // the top of its remaining slice.
  const originOffsets = new Map<string, number>();
  const chokeInOffsets = new Map<string, number>();
  const chokeOutOffsets = new Map<string, number>();
  const destOffsets = new Map<string, number>();

  const byId = (list: LaidOutNode[], id: string) => list.find((n) => n.id === id);

  const ribbons: Ribbon[] = [];

  for (const leg of snapshot.legs) {
    const origin = byId(originNodes, leg.origin);
    const choke = byId(chokepointNodes, leg.chokepoint);
    const dest = byId(destinationNodes, leg.destination);
    if (!origin || !choke || !dest) continue;

    const originRatio = leg.mbpd / Math.max(origin.totalMbpd, 1e-6);
    const chokeInRatio = leg.mbpd / Math.max(choke.totalMbpd, 1e-6);
    const chokeOutRatio = leg.mbpd / Math.max(choke.totalMbpd, 1e-6);
    const destRatio = leg.mbpd / Math.max(dest.totalMbpd, 1e-6);

    const originThickness = origin.height * originRatio;
    const chokeInThickness = choke.height * chokeInRatio;
    const chokeOutThickness = choke.height * chokeOutRatio;
    const destThickness = dest.height * destRatio;

    const y0Start = origin.y + (originOffsets.get(origin.id) ?? 0);
    const y1Start = choke.y + (chokeInOffsets.get(choke.id) ?? 0);
    const y1OutStart = choke.y + (chokeOutOffsets.get(choke.id) ?? 0);
    const y2Start = dest.y + (destOffsets.get(dest.id) ?? 0);

    originOffsets.set(origin.id, (originOffsets.get(origin.id) ?? 0) + originThickness);
    chokeInOffsets.set(choke.id, (chokeInOffsets.get(choke.id) ?? 0) + chokeInThickness);
    chokeOutOffsets.set(choke.id, (chokeOutOffsets.get(choke.id) ?? 0) + chokeOutThickness);
    destOffsets.set(dest.id, (destOffsets.get(dest.id) ?? 0) + destThickness);

    const x0 = origin.x + NODE_WIDTH;
    const x1 = choke.x;
    const x1Out = choke.x + NODE_WIDTH;
    const x2 = dest.x;

    // Draw two ribbons: origin → choke (centerline at slice) and choke → dest.
    const y0Mid = y0Start + originThickness / 2;
    const y1Mid = y1Start + chokeInThickness / 2;
    const y1OutMid = y1OutStart + chokeOutThickness / 2;
    const y2Mid = y2Start + destThickness / 2;

    ribbons.push({
      id: `${leg.origin}-${leg.chokepoint}-${leg.destination}-in`,
      path: bezierPath(x0, y0Mid, x1, y1Mid),
      mbpd: leg.mbpd,
      originId: leg.origin,
      chokepointId: leg.chokepoint,
      destinationId: leg.destination
    });
    ribbons.push({
      id: `${leg.origin}-${leg.chokepoint}-${leg.destination}-out`,
      path: bezierPath(x1Out, y1OutMid, x2, y2Mid),
      mbpd: leg.mbpd,
      originId: leg.origin,
      chokepointId: leg.chokepoint,
      destinationId: leg.destination
    });
  }

  return { nodes, ribbons, totalMbpd };
}

function stackColumn(
  nodes: { id: string; label: string }[],
  totals: Map<string, number>,
  col: LaidOutNode["col"],
  x: number,
  usableHeight: number,
  paddingTop: number
): LaidOutNode[] {
  const activeNodes = nodes.filter((n) => (totals.get(n.id) ?? 0) > 0);
  if (activeNodes.length === 0) return [];
  const sum = activeNodes.reduce((acc, n) => acc + (totals.get(n.id) ?? 0), 0);
  const gaps = (activeNodes.length - 1) * NODE_GAP;
  const scale = (usableHeight - gaps) / Math.max(sum, 1e-6);
  let y = paddingTop;
  return activeNodes.map((node) => {
    const total = totals.get(node.id) ?? 0;
    const h = Math.max(2, total * scale);
    const laid: LaidOutNode = {
      id: node.id,
      label: node.label,
      col,
      x,
      y,
      height: h,
      totalMbpd: total
    };
    y += h + NODE_GAP;
    return laid;
  });
}

function bezierPath(x0: number, y0: number, x1: number, y1: number): string {
  const mx = (x0 + x1) / 2;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} C ${mx.toFixed(1)} ${y0.toFixed(1)}, ${mx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
