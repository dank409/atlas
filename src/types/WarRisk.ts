import type { DataCadence, DataClassification } from "./DataSource";

export interface WarRiskListing {
  chokepointId: string;
  listed: boolean;
  listedSince: string | null;
  indicativeHmPct: { min: number; max: number };
  notes: string;
}

export interface WarRiskSnapshot {
  asOf: string;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
  note?: string;
  disclaimer?: string;
  chokepointListings: WarRiskListing[];
}
