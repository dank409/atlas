import { describe, expect, it } from "vitest";
import { REGION_BOUNDS, getAssetsBounds, getMaxBounds } from "./mapRegion";
import { makeField, makePipeline, makeRefinery } from "../../test/fixtures";

const [[regionWest, regionSouth], [regionEast, regionNorth]] = REGION_BOUNDS;

describe("getMaxBounds", () => {
  it("always contains the whole region, whatever the panel's shape", () => {
    for (const [width, height] of [
      [1600, 700],
      [900, 900],
      [375, 600]
    ]) {
      const [[west, south], [east, north]] = getMaxBounds(width, height);

      expect(west).toBeLessThan(regionWest);
      expect(south).toBeLessThan(regionSouth);
      expect(east).toBeGreaterThan(regionEast);
      expect(north).toBeGreaterThan(regionNorth);
    }
  });

  it("stays close to the region: nowhere near the whole world", () => {
    const [[west, south], [east, north]] = getMaxBounds(1200, 800);

    expect(west).toBeGreaterThan(5);
    expect(east).toBeLessThan(85);
    expect(south).toBeGreaterThan(0);
    expect(north).toBeLessThan(55);
  });

  it("gives a wide panel more room east-west and a tall panel more room north-south", () => {
    const wide = getMaxBounds(2000, 800);
    const tall = getMaxBounds(400, 800);

    expect(wide[1][0] - wide[0][0]).toBeGreaterThan(tall[1][0] - tall[0][0]);
    expect(tall[1][1] - tall[0][1]).toBeGreaterThan(wide[1][1] - wide[0][1]);
  });

  it("is centred on the region east-west", () => {
    const [[west], [east]] = getMaxBounds(1200, 800);

    expect((west + east) / 2).toBeCloseTo((regionWest + regionEast) / 2);
  });

  it("treats an unmeasured panel as square instead of failing", () => {
    expect(getMaxBounds(0, 0)).toEqual(getMaxBounds(500, 500));
  });
});

describe("getAssetsBounds", () => {
  const abqaiq = makeField({ id: "f1", lat: 26, lon: 49.5 });
  const yanbu = makeRefinery({ id: "r1", lat: 24, lon: 38 });
  // Runs from 49.6 E to 38.1 E.
  const eastWest = makePipeline();

  it("frames the sites it is given", () => {
    expect(getAssetsBounds([abqaiq, yanbu])).toEqual([
      [38, 24],
      [49.5, 26]
    ]);
  });

  it("ignores pipelines when there are sites, since pipelines run far beyond them", () => {
    expect(getAssetsBounds([abqaiq, eastWest])).toEqual(getAssetsBounds([abqaiq]));
  });

  it("frames the pipelines when there are no sites", () => {
    expect(getAssetsBounds([eastWest])).toEqual([
      [38.1, 24.1],
      [49.6, 25.9]
    ]);
  });

  it("gives a single site a box with some area around it", () => {
    expect(getAssetsBounds([abqaiq])).toEqual([
      [49, 25.5],
      [50, 26.5]
    ]);
  });

  it("has nothing to frame when given nothing", () => {
    expect(getAssetsBounds([])).toBeNull();
  });
});
