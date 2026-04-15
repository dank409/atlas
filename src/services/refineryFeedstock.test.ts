import { loadRefineryFeedstockSnapshot } from "./refineryFeedstock";
import type {
  RefineryFeedstockEntry,
  RefineryFeedstockSnapshot
} from "../types/refineryFeedstock";

const abadan: RefineryFeedstockEntry = {
  refineryId: "refinery-ir-abadan-refinery",
  hormuzDependency: 1.0,
  dominantGrades: ["Iranian Heavy", "Iranian Light"],
  bypassAccessible: false,
  note: "Fully Hormuz-locked."
};

const yanbu: RefineryFeedstockEntry = {
  refineryId: "refinery-sa-yanbu-refinery",
  hormuzDependency: 0.2,
  dominantGrades: ["Arab Light"],
  bypassAccessible: true,
  note: "Petroline terminal."
};

const healthyPayload: RefineryFeedstockSnapshot = {
  mode: "STATIC_SNAPSHOT",
  asOf: "2026-04-15",
  source: "Curated",
  methodology: "Expert scoring.",
  entries: [abadan, yanbu]
};

describe("loadRefineryFeedstockSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads entries from the canonical reference path and forces STATIC_SNAPSHOT mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/reference/refinery_feedstock.json") {
          return { ok: true, json: async () => healthyPayload };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadRefineryFeedstockSnapshot();

    expect(snapshot.mode).toBe("STATIC_SNAPSHOT");
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0].refineryId).toBe("refinery-ir-abadan-refinery");
    expect(snapshot.methodology).toContain("Expert");
  });

  it("drops entries with out-of-range or non-finite hormuzDependency scores", async () => {
    const corruptPayload = {
      ...healthyPayload,
      entries: [
        abadan,
        { ...yanbu, hormuzDependency: 1.5 },
        { ...abadan, refineryId: "refinery-bad-2", hormuzDependency: Number.NaN },
        { ...abadan, refineryId: "refinery-bad-3", hormuzDependency: -0.1 }
      ]
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => corruptPayload }))
    );

    const snapshot = await loadRefineryFeedstockSnapshot();
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].refineryId).toBe("refinery-ir-abadan-refinery");
  });

  it("throws when the snapshot is empty after sanitisation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...healthyPayload, entries: [] })
      }))
    );

    await expect(loadRefineryFeedstockSnapshot()).rejects.toThrow(/empty/);
  });

  it("propagates fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    await expect(loadRefineryFeedstockSnapshot()).rejects.toThrow(/404/);
  });
});
