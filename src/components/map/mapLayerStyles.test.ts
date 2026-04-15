import { describe, expect, it } from "vitest";
import { getChokepointLayerDefinitions, getPipelineLayerDefinitions } from "./mapLayerStyles";

describe("mapLayerStyles", () => {
  it("defines softer layered pipeline rendering with round joins, casing, and hover emphasis", () => {
    const layers = getPipelineLayerDefinitions("pipelines");
    const layerIds = layers.map((layer) => layer.id);

    expect(layerIds).toEqual([
      "pipelines-casing-layer",
      "pipelines-layer",
      "pipelines-schematic-layer",
      "pipelines-hover-layer",
      "pipelines-hit-layer",
      "pipelines-selected-layer"
    ]);

    const casingLayer = layers[0];
    const baseLayer = layers[1];
    const hoverLayer = layers[3];

    expect(casingLayer.layout).toMatchObject({
      "line-cap": "round",
      "line-join": "round"
    });
    expect(baseLayer.layout).toMatchObject({
      "line-cap": "round",
      "line-join": "round"
    });
    expect(hoverLayer.layout).toMatchObject({
      "line-cap": "round",
      "line-join": "round"
    });

    expect(Number(casingLayer.paint["line-opacity"])).toBeGreaterThan(0.5);
    expect(Number(baseLayer.paint["line-blur"])).toBeGreaterThan(0);
    expect(Number(hoverLayer.paint["line-opacity"])).toBe(1);
  });

  it("defines chokepoint layers with the same softened geometry contract and a hover layer", () => {
    const layers = getChokepointLayerDefinitions("chokepoints");
    const layerIds = layers.map((layer) => layer.id);

    expect(layerIds).toEqual([
      "chokepoints-casing-layer",
      "chokepoints-layer",
      "chokepoints-hover-layer",
      "chokepoints-hit-layer",
      "chokepoints-selected-layer"
    ]);

    expect(layers[0].layout).toMatchObject({
      "line-cap": "round",
      "line-join": "round"
    });
    expect(layers[1].layout).toMatchObject({
      "line-cap": "round",
      "line-join": "round"
    });
    expect(Number(layers[2].paint["line-opacity"])).toBe(1);
  });
});
