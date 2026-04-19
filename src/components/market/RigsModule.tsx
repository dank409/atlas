import { Panel } from "../common/Panel";
import type { RigCountSnapshot } from "../../types/Rigs";
import styles from "./RigsModule.module.css";

interface RigsModuleProps {
  snapshot: RigCountSnapshot | null;
  /**
   * Region focus used by the LeftRail — when "MENA" / "AG" /
   * "RED_SEA" / "LEVANT", the Middle East rows are prioritised and
   * the North America rows follow as a context block at the bottom.
   * Defaults to showing everything in source order.
   */
  meFocus?: boolean;
}

/**
 * Baker Hughes rig count module. Renders a dense bar-chart table:
 * one row per region with a track bar proportional to the largest
 * value in the set and a signed change column.
 */
export function RigsModule({ snapshot, meFocus = true }: RigsModuleProps) {
  if (!snapshot || snapshot.regions.length === 0) {
    return (
      <Panel badge="BAKER HUGHES · WK" title="RIG COUNT">
        <div className={styles.empty}>NO RIG COUNT DATA</div>
      </Panel>
    );
  }

  // Split MENA rows from North America rows so the Middle East
  // analyst sees regional numbers first, NA as context.
  const meCodes = new Set(["SA", "AE", "KW", "IQ", "OM", "QA", "EG"]);
  const me = snapshot.regions.filter((r) => meCodes.has(r.code));
  const na = snapshot.regions.filter((r) => !meCodes.has(r.code));
  const ordered = meFocus ? [...me, ...na] : snapshot.regions;
  const maxValue = Math.max(...ordered.map((r) => r.value));

  return (
    <Panel badge="BAKER HUGHES · CURATED" title="RIG COUNT">
      <div className={styles.rows}>
        {ordered.map((row) => {
          const pct = Math.max(0.03, row.value / (maxValue || 1));
          const isMe = meCodes.has(row.code);
          return (
            <div className={styles.row} key={row.code}>
              <span className={isMe ? styles.labelMe : styles.label}>
                {row.country}
              </span>
              <div className={styles.track}>
                <div
                  className={styles.fill}
                  style={{ width: `${(pct * 100).toFixed(1)}%` }}
                />
              </div>
              <span className={styles.value}>{row.value}</span>
              <span className={changeClass(row.change, styles)}>
                {formatChange(row.change)}
              </span>
              <span className={styles.cadence}>{row.cadence === "WEEKLY" ? "W" : "M"}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.footer}>
        <span>{snapshot.source}</span>
        <span className={styles.footerDot}>·</span>
        <span>AS OF {snapshot.asOf}</span>
      </div>
    </Panel>
  );
}

function formatChange(value: number): string {
  if (value > 0) return `+${value}`;
  return value.toString();
}

function changeClass(value: number, stylesMap: Record<string, string>): string {
  if (value > 0) return stylesMap.changePos;
  if (value < 0) return stylesMap.changeNeg;
  return stylesMap.changeFlat;
}
