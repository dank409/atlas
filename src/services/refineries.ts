import type { RefineryFeatureCollection } from "../types/Refinery";

export async function loadRefineries(): Promise<RefineryFeatureCollection> {
  const response = await fetch("/data/infrastructure/refineries.geojson");

  if (!response.ok) {
    throw new Error(`Failed to load refineries: ${response.status}`);
  }

  const payload = (await response.json()) as RefineryFeatureCollection;

  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features) || !payload._metadata) {
    throw new Error("Invalid refinery collection payload");
  }

  return payload;
}
