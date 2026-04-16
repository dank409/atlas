import type { DataCadence, DataClassification, DataSourceMetadata } from "./DataSource";

export interface PricePoint {
  date: string; // YYYY-MM-DD
  value: number; // $/bbl
}

export interface CrudeBenchmarkSeries {
  brent: PricePoint[];
  wti: PricePoint[];
}

export interface CrudePriceSnapshot extends DataSourceMetadata {
  series: CrudeBenchmarkSeries;
}

export interface BenchmarkQuote {
  name: "BRENT" | "WTI" | "DME_OMAN" | "MURBAN";
  asOf: string;
  cadence: DataCadence;
  value: number;
  change: number;
  changePct: number;
  classification: DataClassification;
  source: string;
}

// DME Oman and Murban share the same shape as CrudePriceSnapshot but
// carry their own single-series key. Kept as distinct types rather than
// a generic so the service layer can enforce the snapshot mode contract
// per benchmark (per CLAUDE.md Data Integrity Rule #6).

export interface DmeOmanSnapshot extends DataSourceMetadata {
  series: { dmeOman: PricePoint[] };
}

export interface MurbanSnapshot extends DataSourceMetadata {
  series: { murban: PricePoint[] };
}

export interface BenchmarkSpreadPoint extends PricePoint {}

export interface BrentWtiSpreadHistory extends DataSourceMetadata {
  series: { brentWti: BenchmarkSpreadPoint[] };
}

export interface BrentTimespreadSnapshot extends DataSourceMetadata {
  m1MinusM2: number;
  m1MinusM6: number;
  m1MinusM12: number;
  structure: "BACKWARDATION" | "CONTANGO" | "FLAT";
}

export interface EiaWeeklyInventoryPoint {
  date: string;
  fiveYearAverage: number;
  fiveYearMax: number;
  fiveYearMin: number;
  value: number;
}

export type InventoryRangePositionLabel = "BELOW_RANGE" | "WITHIN_RANGE" | "ABOVE_RANGE";

export interface EiaWeeklyInventoryLatestSummary {
  date: string;
  value: number;
  fiveYearAverage: number;
  fiveYearMin: number;
  fiveYearMax: number;
  deltaVsAverage: number;
  deltaPctVsAverage: number;
  rangePosition: number;
  rangePositionLabel: InventoryRangePositionLabel;
}

export interface EiaWeeklyInventorySnapshot extends DataSourceMetadata {
  latest: EiaWeeklyInventoryLatestSummary;
  series: EiaWeeklyInventoryPoint[];
  seriesName: string;
  units: "million_barrels";
}

export interface CrudeMarketSummary {
  asOf: string;
  brent: BenchmarkQuote;
  wti: BenchmarkQuote;
  /** Gulf medium-sour marker — the deliverable DME Oman futures basis. */
  dmeOman?: BenchmarkQuote;
  /** ADNOC light-sour, the IFAD-traded Gulf light benchmark. */
  murban?: BenchmarkQuote;
  /** Brent minus WTI. Positive = Brent premium / transatlantic arb incentive. */
  brentWtiSpread: number;
  /**
   * Brent minus DME Oman (positive = Oman discount / east-of-Suez
   * arbitrage incentive to ship Gulf barrels west). Undefined while
   * either leg is still loading or sanitised out.
   */
  brentDmeOmanSpread?: number;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
}
