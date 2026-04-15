import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type RuntimeFeatureCollection = {
  _metadata?: {
    downloadDate?: string;
    recordCount?: number;
    source?: string;
  };
  features: Array<{
    geometry?: {
      coordinates?: unknown;
      type?: string | null;
    } | null;
    properties?: Record<string, unknown>;
  }>;
  type: string;
};

describe("published workspace datasets", () => {
  it("publishes real field, terminal, pipeline, and refinery data instead of seed placeholders", () => {
    const refineries = loadCollection("public/data/infrastructure/refineries.geojson");
    const fields = loadCollection("public/data/infrastructure/fields.geojson");
    const terminals = loadCollection("public/data/infrastructure/terminals.geojson");
    const pipelines = loadCollection("public/data/infrastructure/pipelines.geojson");

    expect(refineries.type).toBe("FeatureCollection");
    expect(fields.type).toBe("FeatureCollection");
    expect(terminals.type).toBe("FeatureCollection");
    expect(pipelines.type).toBe("FeatureCollection");

    expect(refineries.features.length).toBeGreaterThan(20);
    expect(fields.features.length).toBeGreaterThan(0);
    expect(terminals.features.length).toBeGreaterThan(0);
    expect(pipelines.features.length).toBeGreaterThan(100);

    expect(refineries._metadata?.source).toContain("OGIM");
    expect(fields._metadata?.source).toContain("Global Energy Monitor");
    expect(terminals._metadata?.source).toContain("Global Energy Monitor");
    expect(pipelines._metadata?.source).toContain("Global Energy Monitor");
    expect(refineries._metadata?.source).not.toContain("seed");
    expect(pipelines._metadata?.source).not.toContain("seed");
  });

  it("publishes refinery rows with honest unknown handling instead of invented statuses", () => {
    const refineries = loadCollection("public/data/infrastructure/refineries.geojson");
    const featureIds = refineries.features
      .map((feature) => String(feature.properties?.id ?? ""))
      .filter(Boolean);

    expect(
      refineries.features.every((feature) => feature.geometry?.type === "Point")
    ).toBe(true);
    expect(new Set(featureIds).size).toBe(featureIds.length);
    expect(
      refineries.features.some((feature) => feature.properties?.status === "unknown")
    ).toBe(true);
  });

  it("only publishes pipeline geometries that the map can render directly", () => {
    const pipelines = loadCollection("public/data/infrastructure/pipelines.geojson");

    expect(
      pipelines.features.every((feature) => {
        const type = feature.geometry?.type;

        return type === "LineString" || type === "MultiLineString";
      })
    ).toBe(true);
  });
});

function loadCollection(path: string): RuntimeFeatureCollection {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as RuntimeFeatureCollection;
}
