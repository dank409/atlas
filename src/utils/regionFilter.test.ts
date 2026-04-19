import { describe, expect, it } from "vitest";
import { filterAssetsByRegion, formatRegionLabel } from "./regionFilter";
import type { InfrastructureAsset } from "../types/Infrastructure";

function makeRefinery(country: string, id: string): InfrastructureAsset {
  return {
    assetKind: "refinery",
    datasetId: "refineries",
    id,
    name: `${id} Refinery`,
    country,
    countryName: country,
    owner: "test",
    operator: "test",
    status: "operational",
    capacityUnit: "bpd",
    lat: 0,
    lon: 0,
    _metadata: { source: "test", downloadDate: "2026-04-19" }
  };
}

const ASSETS: InfrastructureAsset[] = [
  makeRefinery("SA", "sa1"),
  makeRefinery("AE", "ae1"),
  makeRefinery("IR", "ir1"),
  makeRefinery("EG", "eg1"),
  makeRefinery("SY", "sy1"),
  makeRefinery("TR", "tr1"),
  makeRefinery("YE", "ye1")
];

describe("filterAssetsByRegion", () => {
  it("MENA is a pass-through", () => {
    expect(filterAssetsByRegion(ASSETS, "MENA")).toHaveLength(ASSETS.length);
  });

  it("AG narrows to Gulf producers", () => {
    const filtered = filterAssetsByRegion(ASSETS, "AG").map((a) => a.country);
    expect(filtered).toContain("SA");
    expect(filtered).toContain("AE");
    expect(filtered).toContain("IR");
    expect(filtered).not.toContain("EG");
    expect(filtered).not.toContain("SY");
    expect(filtered).not.toContain("TR");
  });

  it("RED_SEA includes Yemen, Egypt, Saudi Arabia but not Iran or Turkey", () => {
    const filtered = filterAssetsByRegion(ASSETS, "RED_SEA").map((a) => a.country);
    expect(filtered).toContain("YE");
    expect(filtered).toContain("EG");
    expect(filtered).toContain("SA");
    expect(filtered).not.toContain("IR");
    expect(filtered).not.toContain("TR");
  });

  it("LEVANT includes Syria and Turkey but not Gulf states", () => {
    const filtered = filterAssetsByRegion(ASSETS, "LEVANT").map((a) => a.country);
    expect(filtered).toContain("SY");
    expect(filtered).toContain("TR");
    expect(filtered).not.toContain("SA");
    expect(filtered).not.toContain("AE");
  });
});

describe("formatRegionLabel", () => {
  it("humanises RED_SEA to RED SEA", () => {
    expect(formatRegionLabel("RED_SEA")).toBe("RED SEA");
  });

  it("passes single-word region codes through unchanged", () => {
    expect(formatRegionLabel("MENA")).toBe("MENA");
    expect(formatRegionLabel("AG")).toBe("AG");
    expect(formatRegionLabel("LEVANT")).toBe("LEVANT");
  });
});
