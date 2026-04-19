import type { RigCountRow, RigCountSnapshot } from "../types/Rigs";

/**
 * Baker Hughes weekly North America + monthly international rig
 * count. The BH site at rigcount.bakerhughes.com doesn't serve
 * CORS headers to browsers, so a direct `fetch` from the client
 * would fail in production. We ship a curated snapshot at
 * `/data/rigs/baker_hughes.json` and label the cadence explicitly
 * per row. A future enhancement (outside current scope) would be a
 * serverless proxy that scrapes the BH weekly PDF and updates the
 * snapshot on a cron.
 *
 * This mirrors the DME Oman / Murban pattern where the source is
 * real but the delivery mechanism is a checked-in JSON.
 */
const STATIC_SNAPSHOT_PATH = "/data/rigs/baker_hughes.json";

interface RigCountPayload {
  _metadata?: {
    source?: string;
    reportDate?: string;
    note?: string;
  };
  regions?: RigCountRow[];
}

export async function loadRigCountSnapshot(): Promise<RigCountSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load Baker Hughes rig count: ${response.status}`);
  }

  const payload = (await response.json()) as RigCountPayload;
  const regions = Array.isArray(payload.regions) ? payload.regions : [];

  if (regions.length === 0) {
    throw new Error("Baker Hughes rig count snapshot is empty");
  }

  return {
    asOf: payload._metadata?.reportDate ?? regions[0].asOf,
    cadence: "WEEKLY",
    classification: "CURATED",
    source: payload._metadata?.source ?? "Baker Hughes",
    note: payload._metadata?.note,
    regions
  };
}
