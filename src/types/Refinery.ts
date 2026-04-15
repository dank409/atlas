export interface SourceMetadata {
  source: string;
  downloadDate: string;
  recordCount: number;
  notes?: string;
}

export type RefineryStatus =
  | "operational"
  | "planned_startup"
  | "unplanned_incident"
  | "planned_maintenance"
  | "permanent_closure"
  | "construction"
  | "proposed"
  | "unknown";

export interface RefineryProperties {
  id: string;
  name: string;
  country: string;
  countryName: string;
  owner: string;
  operator: string;
  status: RefineryStatus;
  capacity_bpd?: number;
  capacityUnit: string;
  type: "refinery" | "gas_processing" | "terminal" | "storage" | "lng_plant";
  lat: number;
  lon: number;
  firmsRadius_km: number;
  ticker?: string;
  notes?: string;
}

export interface RefineryFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: RefineryProperties;
}

export interface RefineryFeatureCollection {
  type: "FeatureCollection";
  _metadata: SourceMetadata;
  features: RefineryFeature[];
}
