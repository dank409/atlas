import type { DataSourceMetadata } from "./DataSource";

export type ExposureTargetKind = "asset" | "country" | "chokepoint";

interface BaseExposureEntry {
  displayName: string;
  note?: string;
  relevantBenchmarks?: string[];
  sourceLine?: string;
  targetId: string;
  targetKind: ExposureTargetKind;
}

export interface AssetExposureEntry extends BaseExposureEntry {
  targetKind: "asset";
  dependencyScore?: number;
  exportRoute?: string;
  linkedOutageIds?: string[];
  modeledAtRiskMbpd?: number;
  primaryChokepointId?: string;
  primaryChokepointLabel?: string;
}

export interface CountryExposureEntry extends BaseExposureEntry {
  targetKind: "country";
  bypassCapacityMbpd?: number;
  modeledAtRiskMbpd?: number;
  primaryChokepointId?: string;
  primaryChokepointLabel?: string;
  seaborneExportsMbpd?: number;
}

export interface ChokepointExposureEntry extends BaseExposureEntry {
  targetKind: "chokepoint";
  affectedCountryCodes: string[];
  baselineTransitMbpd: number;
  bypassCapacityMbpd?: number;
  exportSystems: string[];
  modeledAtRiskMbpd?: number;
}

export type ExposureRegistryEntry =
  | AssetExposureEntry
  | CountryExposureEntry
  | ChokepointExposureEntry;

export interface ExposureRegistrySnapshot extends DataSourceMetadata {
  entries: ExposureRegistryEntry[];
  methodology: string;
}
