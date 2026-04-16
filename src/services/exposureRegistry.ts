import type {
  ExposureRegistryEntry,
  ExposureRegistrySnapshot
} from "../types/Exposure";

const STATIC_SNAPSHOT_PATH = "/data/reference/exposure_registry.json";

export async function loadExposureRegistrySnapshot(): Promise<ExposureRegistrySnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load exposure registry: ${response.status}`);
  }

  const payload = (await response.json()) as ExposureRegistrySnapshot;
  const entries = normaliseEntries(payload.entries);

  if (entries.length === 0) {
    throw new Error("Exposure registry is empty");
  }

  return {
    asOf: payload.asOf,
    cadence: "CURATED",
    classification: "CURATED",
    entries,
    methodology: payload.methodology,
    note: payload.note,
    source: payload.source
  };
}

function normaliseEntries(
  raw: ExposureRegistryEntry[] | undefined
): ExposureRegistryEntry[] {
  if (!raw) {
    return [];
  }

  return raw.filter((entry) => {
    return (
      typeof entry.targetId === "string" &&
      entry.targetId.length > 0 &&
      typeof entry.targetKind === "string" &&
      typeof entry.displayName === "string"
    );
  });
}
