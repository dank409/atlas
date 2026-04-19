import styles from "./GlossaryPanel.module.css";

interface GlossaryEntry {
  term: string;
  definition: string;
  category: "market" | "physical" | "geopol" | "contract";
}

/**
 * Curated glossary of oil-market terms a geopol analyst will hit
 * inside Atlas but isn't necessarily fluent in. Intentionally short
 * entries — an expanded definition belongs in a textbook, not a
 * terminal. Terms are sourced from ICE, CME, Platts, and EIA
 * reference material, paraphrased for brevity.
 */
const ENTRIES: GlossaryEntry[] = [
  {
    term: "Backwardation",
    category: "market",
    definition:
      "Forward-curve shape where near-dated contracts settle higher than later ones. Signals tight prompt supply — what the bypass model would call DEPLETING."
  },
  {
    term: "Contango",
    category: "market",
    definition:
      "Inverse of backwardation. Later-dated contracts trade above the prompt — typical of oversupply and carries incentive to store barrels."
  },
  {
    term: "Brent",
    category: "market",
    definition:
      "North Sea light sweet grade; the global crude marker for seaborne barrels. Settles at ICE Futures Europe."
  },
  {
    term: "WTI",
    category: "market",
    definition:
      "West Texas Intermediate; U.S. light sweet benchmark. Settled at NYMEX and physically deliverable at Cushing, OK."
  },
  {
    term: "DME Oman",
    category: "market",
    definition:
      "Medium-sour Gulf benchmark, the only deliverable Middle East crude future. Settled on the Dubai Mercantile Exchange."
  },
  {
    term: "Murban",
    category: "market",
    definition:
      "ADNOC's light-sour grade and the IFAD-traded Gulf light benchmark. Single-grade deliverable, used by Asian refiners."
  },
  {
    term: "API gravity",
    category: "physical",
    definition:
      "Inverse density scale for crude. Higher API = lighter, lower viscosity, more distillate yield. Arab Light is ~33°; Maya is ~22°."
  },
  {
    term: "Sulfur content",
    category: "physical",
    definition:
      "Weight % sulfur. <0.5% is 'sweet', >0.5% is 'sour'. Refiners with hydrotreaters can process sour; simple refineries can't."
  },
  {
    term: "Nelson Complexity",
    category: "physical",
    definition:
      "Numerical score of refinery capability to upgrade heavy/sour feedstocks. Higher = more conversion capacity = higher-value product slate."
  },
  {
    term: "VLCC",
    category: "physical",
    definition:
      "Very Large Crude Carrier. 200–320 kdwt. The workhorse of Middle East → Asia flows. ~2 million barrels per cargo."
  },
  {
    term: "STS transfer",
    category: "physical",
    definition:
      "Ship-to-ship cargo transfer at sea. Common for cargoes avoiding sanctions or reaching ports that can't accept VLCCs."
  },
  {
    term: "Chokepoint",
    category: "geopol",
    definition:
      "Narrow maritime passage carrying outsized share of global trade. Hormuz (≈21 Mbpd), Bab el-Mandeb (≈8.2 Mbpd), Suez+SUMED (≈9.2 Mbpd)."
  },
  {
    term: "OPEC+",
    category: "geopol",
    definition:
      "OPEC members plus ten cooperating non-members (notably Russia, Kazakhstan, Oman). Coordinated quota framework since 2016."
  },
  {
    term: "SPR",
    category: "geopol",
    definition:
      "Strategic Petroleum Reserve. U.S. government stockpile, nominal max release ~4.4 Mbpd, but practical draw rate is limited."
  },
  {
    term: "OECD commercial stocks",
    category: "geopol",
    definition:
      "Industry inventories in OECD countries. The IEA's operational minimum (~2,700 Mbbl) is the floor the bypass model watches for breach."
  },
  {
    term: "Crack spread",
    category: "market",
    definition:
      "Refining margin proxy. 3-2-1 = 3 barrels crude → 2 gasoline + 1 distillate, priced as a spread. Positive = refiner incentive to run."
  },
  {
    term: "Differential",
    category: "contract",
    definition:
      "Price of a physical grade vs. its marker. E.g. 'Arab Light at Brent −0.40' means Saudi Arab Light delivered at Brent minus $0.40/bbl."
  },
  {
    term: "Basis",
    category: "contract",
    definition:
      "Difference between cash/physical price and the nearby futures settlement. A proxy for physical tightness."
  }
];

const CATEGORY_LABELS: Record<GlossaryEntry["category"], string> = {
  market: "MARKET",
  physical: "PHYSICAL",
  geopol: "GEOPOLITICAL",
  contract: "CONTRACT"
};

export function GlossaryPanel() {
  return (
    <div className={styles.glossary}>
      <div className={styles.header}>
        <span className={styles.title}>OIL-MARKET GLOSSARY</span>
        <span className={styles.count}>{ENTRIES.length} TERMS · CURATED</span>
      </div>
      <dl className={styles.list}>
        {ENTRIES.map((entry) => (
          <div className={styles.entry} key={entry.term}>
            <dt className={styles.termRow}>
              <span className={styles.term}>{entry.term}</span>
              <span className={styles.category}>{CATEGORY_LABELS[entry.category]}</span>
            </dt>
            <dd className={styles.definition}>{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
