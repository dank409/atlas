import type { DataCadence, DataClassification } from "./DataSource";

/**
 * Baker Hughes rig count row. `cadence` is per-region because BH
 * publishes North America weekly (Fridays) but international monthly.
 * `change` is the delta from the previous published report.
 */
export interface RigCountRow {
  country: string;
  code: string;
  cadence: "WEEKLY" | "MONTHLY";
  asOf: string;
  value: number;
  change: number;
  note?: string;
}

export interface RigCountSnapshot {
  asOf: string;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
  note?: string;
  regions: RigCountRow[];
}
