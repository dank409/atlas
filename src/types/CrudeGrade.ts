import type { PriceSeriesMode } from "./Market";

// Canonical crude-grade taxonomy for the region. The buckets are defined
// by the classic API/sulfur quadrant used across EIA, Platts, and ICE
// assay notes: sweet ≡ sulfur < 0.5%, light ≡ API > 35, heavy ≡ API < 25.
// Medium sits in the 25–35 band on the API axis.
export type CrudeClassification =
  | "light-sweet"
  | "light-sour"
  | "medium-sweet"
  | "medium-sour"
  | "heavy-sweet"
  | "heavy-sour";

export interface CrudeGrade {
  id: string;
  name: string;
  producer: string;
  producerIso: string;
  apiGravity: number;
  sulfurPct: number;
  classification: CrudeClassification;
  pricingRef: string;
  productionMbpd: number;
  note: string;
}

export interface CrudeGradeSnapshot {
  mode: PriceSeriesMode;
  asOf: string;
  source: string;
  grades: CrudeGrade[];
}
