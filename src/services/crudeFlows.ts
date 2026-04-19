import type { FlowLeg, FlowNode, FlowSnapshot } from "../types/Flows";

const STATIC_SNAPSHOT_PATH = "/data/flows/crude_bilateral_monthly.json";

interface Payload {
  _metadata?: {
    source?: string;
    reportDate?: string;
    monthLabel?: string;
    note?: string;
  };
  origins?: FlowNode[];
  chokepoints?: FlowNode[];
  destinations?: FlowNode[];
  legs?: FlowLeg[];
}

export async function loadFlowSnapshot(): Promise<FlowSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load crude flows snapshot: ${response.status}`);
  }
  const payload = (await response.json()) as Payload;
  const legs = Array.isArray(payload.legs) ? payload.legs : [];
  if (legs.length === 0) {
    throw new Error("Crude flows snapshot is empty");
  }
  return {
    asOf: payload._metadata?.reportDate ?? "",
    monthLabel: payload._metadata?.monthLabel ?? "",
    cadence: "MONTHLY",
    classification: "CURATED",
    source: payload._metadata?.source ?? "Curated",
    note: payload._metadata?.note,
    origins: payload.origins ?? [],
    chokepoints: payload.chokepoints ?? [],
    destinations: payload.destinations ?? [],
    legs
  };
}
