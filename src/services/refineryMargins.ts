import type { RefineryMarginRow, RefineryMarginSnapshot } from "../types/RefineryMargins";

const STATIC_SNAPSHOT_PATH = "/data/market/refinery_margins.json";

interface Payload {
  _metadata?: {
    source?: string;
    reportDate?: string;
    note?: string;
  };
  margins?: RefineryMarginRow[];
}

/**
 * Refinery-margin (crack-spread) snapshot loader. Reads a curated
 * JSON at `/data/market/refinery_margins.json`. No live fetch yet —
 * the industry-standard sources (Platts for Singapore 3-2-1 and
 * Dubai 1-1, NYMEX for RBOB/ULSD, ICE for NWE Gasoil) all require
 * either paid subscriptions or server-side computation against EIA
 * weekly product prices.
 */
export async function loadRefineryMarginSnapshot(): Promise<RefineryMarginSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load refinery margin snapshot: ${response.status}`);
  }
  const payload = (await response.json()) as Payload;
  const margins = Array.isArray(payload.margins) ? payload.margins : [];
  if (margins.length === 0) {
    throw new Error("Refinery margin snapshot is empty");
  }
  return {
    asOf: payload._metadata?.reportDate ?? "",
    cadence: "WEEKLY",
    classification: "CURATED",
    source: payload._metadata?.source ?? "Curated",
    note: payload._metadata?.note,
    margins
  };
}
