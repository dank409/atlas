export type DataCadence =
  | "NRT_SATELLITE"
  | "EOD"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "CURATED"
  | "MODELED";

export type DataClassification = "OBSERVED" | "CURATED" | "MODELED";

export interface DataSourceMetadata {
  asOf: string;
  cadence: DataCadence;
  classification: DataClassification;
  note?: string;
  source: string;
}

export function formatCadenceLabel(cadence: DataCadence): string {
  switch (cadence) {
    case "NRT_SATELLITE":
      return "NRT SATELLITE";
    case "EOD":
      return "EOD";
    case "WEEKLY":
      return "WEEKLY";
    case "MONTHLY":
      return "MONTHLY";
    case "QUARTERLY":
      return "QUARTERLY";
    case "CURATED":
      return "CURATED";
    case "MODELED":
      return "MODELED";
  }
}

export function formatClassificationLabel(
  classification: DataClassification
): string {
  switch (classification) {
    case "OBSERVED":
      return "OBSERVED";
    case "CURATED":
      return "CURATED";
    case "MODELED":
      return "MODELED";
  }
}
