import { Panel } from "../common/Panel";
import type { RefineryMarginSnapshot } from "../../types/RefineryMargins";
import styles from "./RefineryMarginsModule.module.css";

interface RefineryMarginsModuleProps {
  snapshot: RefineryMarginSnapshot | null;
}

/**
 * Crack-spread + refinery-margin proxy module. Each row is a named
 * margin (Singapore 3-2-1, RBOB Gasoline, ULSD Heating, Dubai 1-1,
 * NWE Gasoil) in $/bbl, with a signed change vs. the prior report.
 * Values are curated from public sources — see
 * `/data/market/refinery_margins.json` for sourcing notes.
 */
export function RefineryMarginsModule({ snapshot }: RefineryMarginsModuleProps) {
  if (!snapshot || snapshot.margins.length === 0) {
    return (
      <Panel badge="CURATED" title="REFINERY MARGINS">
        <div className={styles.empty}>NO MARGIN DATA</div>
      </Panel>
    );
  }

  return (
    <Panel badge={`USD/BBL · AS OF ${snapshot.asOf}`} title="REFINERY MARGINS">
      <div className={styles.rows}>
        {snapshot.margins.map((row) => (
          <div className={styles.row} key={row.label}>
            <span className={styles.label}>{row.label}</span>
            <span className={styles.value}>{row.valueUsdBbl.toFixed(2)}</span>
            <span className={changeClass(row.change, styles)}>
              {formatChange(row.change)}
            </span>
            <span className={styles.region}>{row.region}</span>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span>{snapshot.source}</span>
      </div>
    </Panel>
  );
}

function formatChange(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function changeClass(value: number, stylesMap: Record<string, string>): string {
  if (value > 0) return stylesMap.changePos;
  if (value < 0) return stylesMap.changeNeg;
  return stylesMap.changeFlat;
}
