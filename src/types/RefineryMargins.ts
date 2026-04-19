import type { DataCadence, DataClassification } from "./DataSource";

export interface RefineryMarginRow {
  label: string;
  valueUsdBbl: number;
  change: number;
  region: string;
  source: string;
}

export interface RefineryMarginSnapshot {
  asOf: string;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
  note?: string;
  margins: RefineryMarginRow[];
}
