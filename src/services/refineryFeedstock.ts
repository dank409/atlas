import type {
  RefineryFeedstockEntry,
  RefineryFeedstockSnapshot
} from "../types/refineryFeedstock";

// Static-only loader for the curated refinery → Hormuz-dependency map.
// No live equivalent — the underlying data moves when operator assays
// change, which is measured in months. Follows the same pattern as
// iceSettlements.ts so the UI can uniformly badge mode = STATIC_SNAPSHOT.

const STATIC_SNAPSHOT_PATH = "/data/reference/refinery_feedstock.json";

export async function loadRefineryFeedstockSnapshot(): Promise<RefineryFeedstockSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load refinery feedstock snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as RefineryFeedstockSnapshot;
  const entries = normaliseEntries(payload.entries);

  if (entries.length === 0) {
    throw new Error("Refinery feedstock snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    mode: "STATIC_SNAPSHOT",
    source: payload.source,
    methodology: payload.methodology,
    entries
  };
}

function normaliseEntries(raw: RefineryFeedstockEntry[] | undefined): RefineryFeedstockEntry[] {
  if (!raw) {
    return [];
  }

  return raw.filter((entry) => {
    return (
      typeof entry.refineryId === "string" &&
      entry.refineryId.length > 0 &&
      Number.isFinite(entry.hormuzDependency) &&
      entry.hormuzDependency >= 0 &&
      entry.hormuzDependency <= 1 &&
      Array.isArray(entry.dominantGrades) &&
      typeof entry.bypassAccessible === "boolean"
    );
  });
}
