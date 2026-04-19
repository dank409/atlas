import { useState } from "react";
import styles from "./ReferencePage.module.css";
import { PagePlaceholder } from "./PagePlaceholder";
import type { ReferenceSubView } from "../types/View";
import { GlossaryPanel } from "./reference/GlossaryPanel";
import { RefineryReferenceTable } from "./reference/RefineryReferenceTable";
import type { RefineryAsset } from "../types/Infrastructure";

interface ReferencePageProps {
  refineries: RefineryAsset[];
  onInspectRefinery: (asset: RefineryAsset) => void;
}

const SUBTABS: { id: ReferenceSubView; label: string }[] = [
  { id: "refineries", label: "REFINERIES" },
  { id: "voyages", label: "VOYAGES" },
  { id: "news", label: "NEWS" },
  { id: "glossary", label: "GLOSSARY" }
];

/**
 * REFERENCE tab with internal sub-nav. Groups four loosely-related
 * reference surfaces that don't deserve their own top-level tab:
 *
 *   REFINERIES — curated MENA refinery grid (real data)
 *   VOYAGES    — vessel track timeline (awaiting AIS feed)
 *   NEWS       — GDELT 2.0 reader (awaiting integration)
 *   GLOSSARY   — curated oil-market terminology
 */
export function ReferencePage({
  refineries,
  onInspectRefinery
}: ReferencePageProps) {
  const [active, setActive] = useState<ReferenceSubView>("refineries");

  return (
    <div className={styles.page}>
      <div className={styles.subtabs}>
        {SUBTABS.map((tab) => (
          <button
            className={tab.id === active ? styles.tabActive : styles.tab}
            key={tab.id}
            onClick={() => setActive(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        {active === "refineries" ? (
          <RefineryReferenceTable
            onInspectRefinery={onInspectRefinery}
            refineries={refineries}
          />
        ) : null}
        {active === "voyages" ? (
          <PagePlaceholder
            dependencies={[
              "AISStream.io WebSocket integration (see AIS view)",
              "Historical AIS replay (>30d, requires storage)",
              "Route simplification + STS detection"
            ]}
            phase="SUB · VOYAGES"
            statusLine="VESSEL TIMELINES — NOT WIRED"
            summary="Per-vessel voyage ledger: load port → route → discharge → STS → next load, annotated with draft and AIS gaps. Requires the same AIS feed as the AIS tab."
            title="VOYAGES"
          />
        ) : null}
        {active === "news" ? (
          <PagePlaceholder
            dependencies={[
              "GDELT 2.0 events API or BigQuery export",
              "Keyword filter + Middle East geographic filter",
              "Dedup / cluster algorithm to suppress repeat coverage"
            ]}
            phase="SUB · NEWS"
            statusLine="GDELT 2.0 READER — NOT WIRED"
            summary="Dense, three-column reader over Middle East energy events from GDELT 2.0. Keyboard-driven read state. Deliberately excludes the typical newsroom noise — cluster-level only."
            title="NEWS"
          />
        ) : null}
        {active === "glossary" ? <GlossaryPanel /> : null}
      </div>
    </div>
  );
}
