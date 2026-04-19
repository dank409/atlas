import { useMemo } from "react";
import { Panel } from "../components/common/Panel";
import { FlowsSankey } from "../components/flows/FlowsSankey";
import type { FlowSnapshot } from "../types/Flows";
import styles from "./FlowsPage.module.css";

interface FlowsPageProps {
  snapshot: FlowSnapshot | null;
}

/**
 * Crude flows view: origin country → chokepoint → destination region.
 * Ribbon widths are proportional to monthly-average mbpd. The data
 * set is curated monthly from public EIA / OPEC MOMR summaries (see
 * `/data/flows/crude_bilateral_monthly.json` for source notes).
 */
export function FlowsPage({ snapshot }: FlowsPageProps) {
  const totals = useMemo(() => {
    if (!snapshot) return { total: 0, choke: new Map<string, number>() };
    const choke = new Map<string, number>();
    let total = 0;
    for (const leg of snapshot.legs) {
      total += leg.mbpd;
      choke.set(leg.chokepoint, (choke.get(leg.chokepoint) ?? 0) + leg.mbpd);
    }
    return { total, choke };
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className={styles.page}>
        <Panel title="CRUDE FLOWS">
          <div className={styles.loading}>LOADING FLOWS…</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Panel
        badge={`MONTHLY · AS OF ${snapshot.asOf}`}
        title="CRUDE FLOWS · SANKEY"
      >
        <div className={styles.sankeyHeader}>
          <span className={styles.subtitle}>
            MBPD · EIA / OPEC MOMR · ILLUSTRATIVE
          </span>
          <span className={styles.total}>
            TOTAL {totals.total.toFixed(1)} MBPD
          </span>
        </div>
        <FlowsSankey snapshot={snapshot} />
        <div className={styles.sourceLine}>
          <span>SOURCE: {snapshot.source}</span>
          <span className={styles.sep}>·</span>
          <span>{snapshot.monthLabel}</span>
        </div>
      </Panel>

      <Panel badge="7D AVG" title="CHOKEPOINT BOARD">
        <div className={styles.chokeList}>
          {snapshot.chokepoints.map((cp) => {
            const mbpd = totals.choke.get(cp.id) ?? 0;
            const share = totals.total > 0 ? mbpd / totals.total : 0;
            return (
              <div className={styles.chokeRow} key={cp.id}>
                <span className={styles.chokeLabel}>{cp.label}</span>
                <span className={styles.chokeValue}>{mbpd.toFixed(1)} MBPD</span>
                <div className={styles.chokeBar}>
                  <div
                    className={styles.chokeFill}
                    style={{ width: `${(share * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className={styles.chokeShare}>
                  {(share * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel badge="% · MONTHLY" title="DESTINATION MIX">
        <DestinationMix snapshot={snapshot} total={totals.total} />
      </Panel>
    </div>
  );
}

function DestinationMix({ snapshot, total }: { snapshot: FlowSnapshot; total: number }) {
  const byDest = useMemo(() => {
    const map = new Map<string, number>();
    for (const leg of snapshot.legs) {
      map.set(leg.destination, (map.get(leg.destination) ?? 0) + leg.mbpd);
    }
    return snapshot.destinations
      .map((d) => ({
        id: d.id,
        label: d.label,
        mbpd: map.get(d.id) ?? 0,
        share: total > 0 ? (map.get(d.id) ?? 0) / total : 0
      }))
      .sort((a, b) => b.mbpd - a.mbpd);
  }, [snapshot, total]);

  return (
    <div className={styles.destList}>
      {byDest.map((d) => (
        <div className={styles.destRow} key={d.id}>
          <span className={styles.destLabel}>{d.label}</span>
          <div className={styles.destBar}>
            <div
              className={styles.destFill}
              style={{ width: `${(d.share * 100).toFixed(1)}%` }}
            />
          </div>
          <span className={styles.destValue}>
            {d.mbpd.toFixed(2)} ({(d.share * 100).toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
}
