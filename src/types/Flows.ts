import type { DataCadence, DataClassification } from "./DataSource";

export interface FlowNode {
  id: string;
  label: string;
  totalMbpd?: number;
}

export interface FlowLeg {
  origin: string;
  chokepoint: string;
  destination: string;
  mbpd: number;
}

export interface FlowSnapshot {
  asOf: string;
  monthLabel: string;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
  note?: string;
  origins: FlowNode[];
  chokepoints: FlowNode[];
  destinations: FlowNode[];
  legs: FlowLeg[];
}
