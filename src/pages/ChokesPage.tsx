import { useMemo, useState } from "react";
import { Panel } from "../components/common/Panel";
import type { ChokepointAsset } from "../types/Infrastructure";
import type { WarRiskSnapshot, WarRiskListing } from "../types/WarRisk";
import { DEFAULT_BYPASS_CONSTANTS } from "../utils/bypassModel";
import styles from "./ChokesPage.module.css";

interface ChokesPageProps {
  chokepoints: ChokepointAsset[];
  /** Lloyd's JWC curated war-risk listings. Null while loading. */
  warRisk?: WarRiskSnapshot | null;
  /** Optional callback — parent can log activity when the user picks a chokepoint. */
  onSelectChokepoint?: (chokepoint: ChokepointAsset) => void;
}

/** Curated reroute capacity options. Only Hormuz has real published bypass caps. */
const REROUTE_CAPACITY: Record<
  string,
  { name: string; usedMbpd: number; totalMbpd: number; note: string }[]
> = {
  "chokepoint-hormuz": [
    {
      name: "Petroline (East-West)",
      usedMbpd: 3.9,
      totalMbpd: DEFAULT_BYPASS_CONSTANTS.saudiSpareCapacityMbpd + 3.9,
      note: "Yanbu-direction export route"
    },
    {
      name: "ADCOP (Habshan → Fujairah)",
      usedMbpd: 1.0,
      totalMbpd: DEFAULT_BYPASS_CONSTANTS.uaeSpareCapacityMbpd + 1.0,
      note: "Strait-bypass to Arabian Sea"
    }
  ]
};

const INCIDENT_NOTES: Record<string, string> = {
  "chokepoint-hormuz":
    "Historical hotspot for IRGCN-adjacent incidents and periodic tanker interdictions. Real-time escalation feed lives in the EVENTS tab.",
  "chokepoint-bab-el-mandeb":
    "Recent Houthi strike campaign (2024) reduced Red Sea transits materially; many carriers reroute via Cape. Insurance premia elevated.",
  "chokepoint-suez":
    "Dual crude path: tanker transit + SUMED overland, which partially rebalances when canal capacity tightens.",
  "chokepoint-turkish-straits":
    "Bosphorus + Dardanelles. Throughput influenced by weather-driven queueing and Black Sea war-risk posture."
};

export function ChokesPage({
  chokepoints,
  warRisk,
  onSelectChokepoint
}: ChokesPageProps) {
  const sorted = useMemo(
    () => [...chokepoints].sort((a, b) => b.transitVolume_mbpd - a.transitVolume_mbpd),
    [chokepoints]
  );
  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  const active = sorted.find((c) => c.id === activeId) ?? null;

  return (
    <div className={styles.page}>
      <aside className={styles.list}>
        <Panel title="CHOKEPOINTS">
          {sorted.length === 0 ? (
            <div className={styles.empty}>NO CHOKEPOINT DATA</div>
          ) : (
            <div className={styles.listInner}>
              {sorted.map((choke) => (
                <button
                  className={choke.id === activeId ? styles.listRowActive : styles.listRow}
                  key={choke.id}
                  onClick={() => {
                    setActiveId(choke.id);
                    onSelectChokepoint?.(choke);
                  }}
                  type="button"
                >
                  <span className={styles.listName}>{choke.name.toUpperCase()}</span>
                  <span className={styles.listVolume}>
                    {choke.transitVolume_mbpd.toFixed(1)} MBPD
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </aside>

      <section className={styles.main}>
        {active ? (
          <ActiveChokepointDetail chokepoint={active} warRisk={warRisk ?? null} />
        ) : (
          <Panel title="CHOKEPOINT DETAIL">
            <div className={styles.empty}>SELECT A CHOKEPOINT FROM THE LIST</div>
          </Panel>
        )}
      </section>
    </div>
  );
}

function ActiveChokepointDetail({
  chokepoint,
  warRisk
}: {
  chokepoint: ChokepointAsset;
  warRisk: WarRiskSnapshot | null;
}) {
  const lookupKey = chokepoint.id.toLowerCase();
  const rerouteRows = REROUTE_CAPACITY[lookupKey] ?? [];
  const warRiskRow: WarRiskListing | undefined = warRisk?.chokepointListings.find(
    (l) => l.chokepointId === chokepoint.id
  );
  const note = INCIDENT_NOTES[lookupKey];

  return (
    <>
      <Panel
        badge="DEEP DIVE"
        title={chokepoint.name.toUpperCase()}
      >
        <div className={styles.statGrid}>
          <Stat label="FLOW (EIA)" value={chokepoint.transitVolume_mbpd.toFixed(1)} unit="MBPD" />
          <Stat label="ROUTE ID" value={chokepoint.id.toUpperCase()} />
          <Stat label="COUNTRY" value={chokepoint.countryName} />
          <Stat label="DATASET" value="EIA · STATIC" />
        </div>
        {note ? <div className={styles.note}>{note}</div> : null}
      </Panel>

      <Panel badge="EIA" title="REROUTING CAPACITY">
        {rerouteRows.length === 0 ? (
          <div className={styles.empty}>
            NO PUBLISHED BYPASS ROUTES FOR THIS CHOKEPOINT
          </div>
        ) : (
          <div className={styles.rerouteList}>
            {rerouteRows.map((row) => {
              const pct = Math.min(1, row.usedMbpd / row.totalMbpd);
              return (
                <div className={styles.rerouteRow} key={row.name}>
                  <div className={styles.rerouteHead}>
                    <span className={styles.rerouteName}>{row.name}</span>
                    <span className={styles.rerouteVolume}>
                      {row.usedMbpd.toFixed(1)} / {row.totalMbpd.toFixed(1)} MBPD
                    </span>
                  </div>
                  <div className={styles.rerouteTrack}>
                    <div
                      className={styles.rerouteFill}
                      style={{ width: `${(pct * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <div className={styles.rerouteNote}>{row.note}</div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel badge="AWAITING FEED" title="TRANSIT COUNT · 30D">
        <div className={styles.placeholder}>
          Baltic-style daily transit counts require AISStream aggregation.
          Wired in the AIS phase — placeholder until then.
        </div>
      </Panel>

      <Panel
        badge={warRisk ? `LLOYD'S JWC · AS OF ${warRisk.asOf}` : "CURATED"}
        title="WAR-RISK PREMIA · JWC"
      >
        {warRiskRow ? (
          <div className={styles.warRisk}>
            <div className={styles.warRiskStatusRow}>
              <span
                className={
                  warRiskRow.listed ? styles.warRiskListed : styles.warRiskUnlisted
                }
              >
                {warRiskRow.listed ? "JWC LISTED" : "NOT JWC LISTED"}
              </span>
              {warRiskRow.listedSince ? (
                <span className={styles.warRiskSince}>
                  SINCE {warRiskRow.listedSince}
                </span>
              ) : null}
              {warRiskRow.listed ? (
                <span className={styles.warRiskRate}>
                  INDICATIVE H&amp;M {warRiskRow.indicativeHmPct.min.toFixed(2)}–
                  {warRiskRow.indicativeHmPct.max.toFixed(2)}%
                </span>
              ) : null}
            </div>
            <div className={styles.warRiskNote}>{warRiskRow.notes}</div>
            {warRisk?.disclaimer ? (
              <div className={styles.warRiskDisclaimer}>
                {warRisk.disclaimer}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.placeholder}>
            No JWC listing on file for this chokepoint.
          </div>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className={styles.statCell}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {unit ? <span className={styles.statUnit}>{unit}</span> : null}
    </div>
  );
}
