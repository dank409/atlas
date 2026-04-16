import { loadOutageEventSnapshot } from "./outageEvents";
import type { OutageEvent } from "../types/outageEvent";

const abqaiq: OutageEvent = {
  id: "abqaiq-khurais-attack-2019-09-14",
  date: "2019-09-14",
  name: "Abqaiq-Khurais Strike",
  country: "Saudi Arabia",
  severity: "CRITICAL",
  category: "attack",
  outageVolumeBpd: 5700000,
  durationDays: 10,
  summary: "Drone strike.",
  resolved: true,
  priceReaction: { brentChangePct: 14.6, windowHours: 24 }
};

const redSea: OutageEvent = {
  id: "galaxy-leader-seizure-2023-11-19",
  date: "2023-11-19",
  name: "Galaxy Leader Seizure",
  country: "Yemen",
  severity: "MEDIUM",
  category: "attack",
  outageVolumeBpd: 0,
  durationDays: 120,
  summary: "Houthi seizure.",
  resolved: false
};

const healthyPayload = {
  asOf: "2026-04-15",
  cadence: "CURATED" as const,
  classification: "CURATED" as const,
  source: "Curated",
  events: [redSea, abqaiq]
};

describe("loadOutageEventSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads events from the canonical path and marks them CURATED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/events/outages.json") {
          return { ok: true, json: async () => healthyPayload };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadOutageEventSnapshot();

    expect(snapshot.cadence).toBe("CURATED");
    expect(snapshot.classification).toBe("CURATED");
    expect(snapshot.events).toHaveLength(2);
    expect(snapshot.source).toBe("Curated");
  });

  it("sorts events ascending by date regardless of input order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => healthyPayload }))
    );

    const snapshot = await loadOutageEventSnapshot();
    expect(snapshot.events.map((event) => event.id)).toEqual([
      "abqaiq-khurais-attack-2019-09-14",
      "galaxy-leader-seizure-2023-11-19"
    ]);
  });

  it("drops events with invalid severity or category", async () => {
    const corrupt = {
      ...healthyPayload,
      events: [
        abqaiq,
        { ...redSea, severity: "EXTREME" as unknown as OutageEvent["severity"] },
        { ...abqaiq, id: "bad-cat", category: "alien" as unknown as OutageEvent["category"] }
      ]
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => corrupt }))
    );

    const snapshot = await loadOutageEventSnapshot();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].id).toBe("abqaiq-khurais-attack-2019-09-14");
  });

  it("throws when the snapshot is empty after sanitisation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...healthyPayload, events: [] })
      }))
    );

    await expect(loadOutageEventSnapshot()).rejects.toThrow(/empty/);
  });

  it("propagates fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    await expect(loadOutageEventSnapshot()).rejects.toThrow(/404/);
  });
});
