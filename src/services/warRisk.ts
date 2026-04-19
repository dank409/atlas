import type { WarRiskListing, WarRiskSnapshot } from "../types/WarRisk";

const STATIC_SNAPSHOT_PATH = "/data/warrisk/jwc_listings.json";

interface Payload {
  _metadata?: {
    source?: string;
    listDate?: string;
    note?: string;
    disclaimer?: string;
  };
  chokepointListings?: WarRiskListing[];
}

export async function loadWarRiskSnapshot(): Promise<WarRiskSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load war-risk snapshot: ${response.status}`);
  }
  const payload = (await response.json()) as Payload;
  const listings = Array.isArray(payload.chokepointListings)
    ? payload.chokepointListings
    : [];
  return {
    asOf: payload._metadata?.listDate ?? "",
    cadence: "CURATED",
    classification: "CURATED",
    source: payload._metadata?.source ?? "Lloyd's JWC (curated)",
    note: payload._metadata?.note,
    disclaimer: payload._metadata?.disclaimer,
    chokepointListings: listings
  };
}
