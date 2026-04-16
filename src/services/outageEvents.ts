import type { OutageEvent, OutageEventSnapshot } from "../types/outageEvent";

// Curated outage-event log. Static-only — there is no live feed and the
// curator replaces this file as new events land. Follows the same shape
// as iceSettlements.ts / refineryFeedstock.ts: fetch, sanitise, throw
// when empty, and return explicit curated metadata.

const STATIC_SNAPSHOT_PATH = "/data/events/outages.json";

const VALID_SEVERITIES: ReadonlySet<OutageEvent["severity"]> = new Set([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

const VALID_CATEGORIES: ReadonlySet<OutageEvent["category"]> = new Set([
  "attack",
  "accident",
  "maintenance",
  "sanctions",
  "weather",
  "labor"
]);

export async function loadOutageEventSnapshot(): Promise<OutageEventSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load outage event snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as OutageEventSnapshot;
  const events = normaliseEvents(payload.events);

  if (events.length === 0) {
    throw new Error("Outage event snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    cadence: "CURATED",
    classification: "CURATED",
    source: payload.source,
    note: payload.note,
    events
  };
}

function normaliseEvents(raw: OutageEvent[] | undefined): OutageEvent[] {
  if (!raw) {
    return [];
  }

  return raw
    .filter((event) => {
      return (
        typeof event.id === "string" &&
        event.id.length > 0 &&
        typeof event.date === "string" &&
        event.date.length > 0 &&
        typeof event.name === "string" &&
        VALID_SEVERITIES.has(event.severity) &&
        VALID_CATEGORIES.has(event.category) &&
        Number.isFinite(event.outageVolumeBpd) &&
        Number.isFinite(event.durationDays)
      );
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}
