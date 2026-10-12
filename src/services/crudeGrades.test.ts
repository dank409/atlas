import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCrudeGradeSnapshot } from "./crudeGrades";
import type { CrudeGrade, CrudeGradeSnapshot } from "../types/CrudeGrade";

const arabLight: CrudeGrade = {
  id: "arab-light",
  name: "Arab Light",
  producer: "Saudi Arabia",
  producerIso: "SAU",
  apiGravity: 33.4,
  sulfurPct: 1.8,
  note: "Saudi Aramco flagship.",
  source: "Wikipedia"
};

const murban: CrudeGrade = {
  id: "murban",
  name: "Murban",
  producer: "United Arab Emirates",
  producerIso: "ARE",
  apiGravity: 40.2,
  sulfurPct: 0.78,
  note: "ADNOC onshore.",
  source: "EIA"
};

const healthyPayload: CrudeGradeSnapshot = {
  source: "EIA, Wikipedia",
  grades: [arabLight, murban]
};

describe("loadCrudeGradeSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads grades and attribution from the reference path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/reference/crude_grades.json") {
          return { ok: true, json: async () => healthyPayload };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadCrudeGradeSnapshot();

    expect(snapshot.grades).toHaveLength(2);
    expect(snapshot.grades[0].name).toBe("Arab Light");
    expect(snapshot.source).toBe("EIA, Wikipedia");
  });

  it("drops rows with non-finite numeric fields", async () => {
    const corruptPayload = {
      ...healthyPayload,
      grades: [
        arabLight,
        { ...murban, apiGravity: Number.NaN },
        { ...arabLight, id: "arab-heavy", name: "Arab Heavy", sulfurPct: Number.NaN }
      ]
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => corruptPayload }))
    );

    const snapshot = await loadCrudeGradeSnapshot();
    expect(snapshot.grades).toHaveLength(1);
    expect(snapshot.grades[0].id).toBe("arab-light");
  });

  it("throws when the snapshot is empty after sanitisation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...healthyPayload, grades: [] })
      }))
    );

    await expect(loadCrudeGradeSnapshot()).rejects.toThrow(/empty/);
  });

  it("propagates fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    await expect(loadCrudeGradeSnapshot()).rejects.toThrow(/404/);
  });
});
