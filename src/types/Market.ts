// Shared shape for benchmark crude price data. We store everything as
// ($/barrel) daily closes keyed by ISO date. The service layer normalizes
// the two ingest paths (live EIA v2 API + static snapshot JSON) into this
// single structure so downstream components don't have to branch.

export type PriceSeriesMode = "LIVE" | "STATIC_SNAPSHOT";

export interface PricePoint {
  date: string; // YYYY-MM-DD
  value: number; // $/bbl
}

export interface CrudeBenchmarkSeries {
  brent: PricePoint[];
  wti: PricePoint[];
}

export interface CrudePriceSnapshot {
  asOf: string; // ISO date of the most recent observation
  mode: PriceSeriesMode;
  series: CrudeBenchmarkSeries;
  source: string;
  note?: string;
}

export interface BenchmarkQuote {
  name: "BRENT" | "WTI" | "DME_OMAN" | "MURBAN";
  value: number;
  change: number;
  changePct: number;
  asOf: string;
}

// DME Oman and Murban share the same shape as CrudePriceSnapshot but
// carry their own single-series key. Kept as distinct types rather than
// a generic so the service layer can enforce the snapshot mode contract
// per benchmark (per CLAUDE.md Data Integrity Rule #6).

export interface DmeOmanSnapshot {
  asOf: string;
  mode: PriceSeriesMode;
  series: { dmeOman: PricePoint[] };
  source: string;
  note?: string;
}

export interface MurbanSnapshot {
  asOf: string;
  mode: PriceSeriesMode;
  series: { murban: PricePoint[] };
  source: string;
  note?: string;
}

export interface CrudeMarketSummary {
  asOf: string;
  brent: BenchmarkQuote;
  wti: BenchmarkQuote;
  /** Gulf medium-sour marker — the deliverable DME Oman futures basis. */
  dmeOman?: BenchmarkQuote;
  /** ADNOC light-sour, the IFAD-traded Gulf light benchmark. */
  murban?: BenchmarkQuote;
  /** Legacy WTI–Brent spread; kept for the data layer, not surfaced. */
  spread: number;
  /**
   * Brent minus DME Oman (positive = Oman discount / east-of-Suez
   * arbitrage incentive to ship Gulf barrels west). Undefined while
   * either leg is still loading or sanitised out.
   */
  brentDmeOmanSpread?: number;
  mode: PriceSeriesMode;
  source: string;
}
