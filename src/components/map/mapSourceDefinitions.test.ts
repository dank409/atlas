import { describe, expect, it } from "vitest";
import { createPointSourceDefinition } from "./mapSourceDefinitions";

describe("createPointSourceDefinition", () => {
  it("builds plain point sources without map clustering", () => {
    const source = createPointSourceDefinition({
      features: [],
      type: "FeatureCollection"
    });

    expect(source.type).toBe("geojson");
    expect(source.data.type).toBe("FeatureCollection");
    expect(source).not.toHaveProperty("cluster");
    expect(source).not.toHaveProperty("clusterRadius");
    expect(source).not.toHaveProperty("clusterMaxZoom");
  });
});
