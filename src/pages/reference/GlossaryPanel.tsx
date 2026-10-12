import { useEffect, useRef } from "react";
import type { DatasetId } from "../../types/Infrastructure";
import type { NavigateReference } from "../../types/View";
import styles from "./GlossaryPanel.module.css";

/** Where an entry can send the reader to see the term in use. */
type SeeAlso =
  | { kind: "table"; datasetId: DatasetId; label: string }
  | { kind: "reference"; tab: "countries" | "grades"; label: string };

interface GlossaryEntry {
  term: string;
  definition: string;
  category: "unit" | "infrastructure" | "crude";
  seeAlso?: SeeAlso;
}

interface GlossaryPanelProps {
  /** Term to scroll to and outline, when the reader arrived from a link. */
  highlightedTerm?: string | null;
  onNavigate: NavigateReference;
  /** Open the TABLE view on one layer. */
  onOpenTable: (datasetId: DatasetId) => void;
}

const IN_REFINERIES: SeeAlso = { datasetId: "refineries", kind: "table", label: "REFINERIES IN THE TABLE" };
const IN_PIPELINES: SeeAlso = { datasetId: "pipelines", kind: "table", label: "PIPELINES IN THE TABLE" };
const IN_FIELDS: SeeAlso = { datasetId: "fields", kind: "table", label: "FIELDS IN THE TABLE" };
const IN_TERMINALS: SeeAlso = { datasetId: "terminals", kind: "table", label: "LNG TERMINALS IN THE TABLE" };
const IN_GRADES: SeeAlso = { kind: "reference", label: "CRUDE GRADES", tab: "grades" };
const IN_COUNTRIES: SeeAlso = { kind: "reference", label: "EXPORT ROUTES BY COUNTRY", tab: "countries" };

/** The units and terms this app uses, in plain words and kept short. */
const ENTRIES: GlossaryEntry[] = [
  {
    term: "BPD",
    seeAlso: IN_REFINERIES,
    category: "unit",
    definition:
      "Barrels per day. One barrel is 42 US gallons, about 159 litres. Used here for refinery capacity."
  },
  {
    term: "BOE/D",
    seeAlso: IN_PIPELINES,
    category: "unit",
    definition:
      "Barrels of oil equivalent per day. Gas is converted to the amount of oil with the same energy, roughly 6,000 cubic feet of gas per barrel, so oil and gas can be added together. Used here for pipeline capacity and field production."
  },
  {
    term: "MTPA",
    seeAlso: IN_TERMINALS,
    category: "unit",
    definition:
      "Million tonnes per annum, the usual measure of LNG terminal capacity. One MTPA of LNG is roughly 1.4 billion cubic metres of gas a year."
  },
  {
    term: "Refinery",
    seeAlso: IN_REFINERIES,
    category: "infrastructure",
    definition:
      "Plant that turns crude oil into products such as gasoline, diesel and jet fuel. Its capacity is how much crude it can process in a day."
  },
  {
    term: "Oil or gas field",
    seeAlso: IN_FIELDS,
    category: "infrastructure",
    definition:
      "An underground accumulation of oil, gas or both, produced through wells."
  },
  {
    term: "Pipeline",
    seeAlso: IN_PIPELINES,
    category: "infrastructure",
    definition:
      "Carries crude oil, natural gas or NGL overland or under the sea, typically from fields to refineries, processing plants or export terminals."
  },
  {
    term: "LNG",
    seeAlso: IN_TERMINALS,
    category: "infrastructure",
    definition:
      "Liquefied natural gas. Gas cooled to about −162 °C becomes a liquid around 1/600 of its volume, which makes it practical to ship by tanker."
  },
  {
    term: "LNG export / import terminal",
    seeAlso: IN_TERMINALS,
    category: "infrastructure",
    definition:
      "An export terminal liquefies gas and loads it onto ships. An import terminal receives LNG and turns it back into gas for the local grid."
  },
  {
    term: "FSRU",
    seeAlso: IN_TERMINALS,
    category: "infrastructure",
    definition:
      "Floating storage and regasification unit. A moored ship that works as an LNG import terminal, quicker to set up than an onshore plant."
  },
  {
    term: "NGL",
    seeAlso: IN_PIPELINES,
    category: "infrastructure",
    definition:
      "Natural gas liquids: ethane, propane, butane and heavier hydrocarbons separated from raw natural gas."
  },
  {
    term: "Condensate",
    category: "infrastructure",
    definition:
      "Very light liquid hydrocarbons that condense out of gas when it reaches the surface. Often produced alongside gas."
  },
  {
    term: "Upstream / midstream / downstream",
    category: "infrastructure",
    definition:
      "Upstream is finding and producing oil and gas (fields). Midstream is moving and storing it (pipelines, terminals). Downstream is refining and selling products (refineries)."
  },
  {
    term: "VLCC",
    category: "infrastructure",
    definition:
      "Very Large Crude Carrier. 200–320 kdwt. The workhorse of Middle East → Asia flows. ~2 million barrels per cargo."
  },
  {
    term: "Chokepoint",
    seeAlso: IN_COUNTRIES,
    category: "infrastructure",
    definition:
      "A narrow sea passage that a large share of shipped oil and gas must pass through, such as the Strait of Hormuz, Bab el-Mandeb or the Suez Canal."
  },
  {
    term: "API gravity",
    seeAlso: IN_GRADES,
    category: "crude",
    definition:
      "Inverse density scale for crude. Higher API = lighter, lower viscosity, more distillate yield. Arab Light is ~33°; Maya is ~22°."
  },
  {
    term: "Sulfur content",
    seeAlso: IN_GRADES,
    category: "crude",
    definition:
      "Weight % sulfur. <0.5% is 'sweet', >0.5% is 'sour'. Refiners with hydrotreaters can process sour; simple refineries can't."
  },
  {
    term: "Nelson Complexity",
    category: "crude",
    definition:
      "Numerical score of refinery capability to upgrade heavy/sour feedstocks. Higher = more conversion capacity = higher-value product slate."
  }
];

const CATEGORY_LABELS: Record<GlossaryEntry["category"], string> = {
  crude: "CRUDE OIL",
  infrastructure: "INFRASTRUCTURE",
  unit: "UNIT"
};

export function GlossaryPanel({ highlightedTerm = null, onNavigate, onOpenTable }: GlossaryPanelProps) {
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    highlightedRef.current?.scrollIntoView?.({ block: "center" });
  }, [highlightedTerm]);

  return (
    <div className={styles.glossary}>
      <div className={styles.header}>
        <span className={styles.title}>GLOSSARY</span>
        <span className={styles.count}>{ENTRIES.length} TERMS</span>
      </div>
      <dl className={styles.list}>
        {ENTRIES.map((entry) => {
          const isHighlighted = entry.term === highlightedTerm;
          const { seeAlso } = entry;

          return (
            <div
              className={isHighlighted ? styles.entryHighlighted : styles.entry}
              key={entry.term}
              ref={isHighlighted ? highlightedRef : undefined}
            >
              <dt className={styles.termRow}>
                <span className={styles.term}>{entry.term}</span>
                <span className={styles.category}>{CATEGORY_LABELS[entry.category]}</span>
              </dt>
              <dd className={styles.definition}>
                {entry.definition}
                {seeAlso ? (
                  <button
                    className={styles.seeAlso}
                    onClick={() =>
                      seeAlso.kind === "table" ? onOpenTable(seeAlso.datasetId) : onNavigate(seeAlso.tab)
                    }
                    type="button"
                  >
                    {seeAlso.label} ▸
                  </button>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
