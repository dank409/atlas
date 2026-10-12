import { describe, expect, it } from "vitest";
import {
  POINT_DATASET_IDS,
  REFINERY_ICON_ID,
  TERMINAL_ICON_ID,
  getLabelLayerDefinition,
  getOpacityExpression,
  getPipelineHoverFilter,
  getPipelineLayerDefinitions,
  getPointLayerDefinitions,
  getSelectionPaintUpdates,
  getUnmappedRouteUpdates
} from "./mapLayerStyles";
import { ENERGY_COLORS } from "../../utils/assetEnergy";

function findLayer(id: string) {
  const layers = [...getPipelineLayerDefinitions(), ...POINT_DATASET_IDS.flatMap(getPointLayerDefinitions)];
  const layer = layers.find((candidate) => candidate.id === id);

  if (!layer) {
    throw new Error(`No layer ${id}`);
  }

  return layer;
}

describe("getOpacityExpression", () => {
  it("fades assets the source says are not operating", () => {
    expect(getOpacityExpression(1, null)).toEqual(["case", ["get", "isOperating"], 1, 0.45]);
  });

  it("spotlights the selected asset and dims the rest", () => {
    expect(getOpacityExpression(1, "refinery-x")).toEqual(["case", ["==", ["get", "id"], "refinery-x"], 1, 0.5]);
  });
});

describe("colour = energy type", () => {
  it("colours pipelines and fields from the shared energy palette", () => {
    for (const layerId of ["pipelines-layer", "pipelines-schematic-layer"]) {
      const color = findLayer(layerId).paint["line-color"] as unknown[];

      expect(color.slice(0, 2)).toEqual(["match", ["get", "energy"]]);
      expect(color).toContain(ENERGY_COLORS.oil);
      expect(color).toContain(ENERGY_COLORS.gas);
      expect(color).toContain(ENERGY_COLORS.ngl);
      expect(color.at(-1)).toBe(ENERGY_COLORS.mixed);
    }

    expect(findLayer("fields-layer").paint["circle-color"]).toEqual(findLayer("pipelines-layer").paint["line-color"]);
  });
});

describe("shape = asset type", () => {
  it("draws refineries and LNG terminals as icons and fields as dots", () => {
    expect(findLayer("refineries-layer").type).toBe("symbol");
    expect(findLayer("refineries-layer").layout?.["icon-image"]).toBe(REFINERY_ICON_ID);
    expect(findLayer("terminals-layer").layout?.["icon-image"]).toBe(TERMINAL_ICON_ID);
    expect(findLayer("fields-layer").type).toBe("circle");
  });

  it("flips LNG import terminals to point down", () => {
    expect(findLayer("terminals-layer").layout?.["icon-rotate"]).toEqual([
      "match",
      ["get", "terminalRole"],
      "import",
      180,
      0
    ]);
    expect(findLayer("refineries-layer").layout?.["icon-rotate"]).toBe(0);
  });

  it("sizes icons by capacity but keeps fields a fixed size", () => {
    const iconSize = findLayer("refineries-layer").layout?.["icon-size"] as unknown[];

    expect(iconSize.slice(0, 3)).toEqual(["interpolate", ["linear"], ["sqrt", ["get", "sizeValue"]]]);
    expect(typeof findLayer("fields-layer").paint["circle-radius"]).toBe("number");
  });

  it("keeps icons always visible rather than letting Mapbox hide overlapping ones", () => {
    expect(findLayer("terminals-layer").layout?.["icon-allow-overlap"]).toBe(true);
  });
});

describe("pipeline layers", () => {
  it("defines the layer stack in draw order with the hit layer on top", () => {
    expect(getPipelineLayerDefinitions().map((layer) => layer.id)).toEqual([
      "pipelines-casing-layer",
      "pipelines-layer",
      "pipelines-schematic-layer",
      "pipelines-hover-layer",
      "pipelines-selected-layer",
      "pipelines-hit-layer"
    ]);
  });

  it("splits surveyed and schematic routes and dashes the schematic ones", () => {
    expect(findLayer("pipelines-layer").filter).toEqual(["==", ["get", "isRouteMapped"], true]);
    expect(findLayer("pipelines-schematic-layer").filter).toEqual(["==", ["get", "isRouteMapped"], false]);
    expect(findLayer("pipelines-schematic-layer").paint["line-dasharray"]).toEqual([2, 2]);
  });

  it("keeps zoom at the top level of every width expression, as Mapbox requires", () => {
    for (const layer of getPipelineLayerDefinitions()) {
      const width = layer.paint["line-width"] as unknown[];

      expect(width.slice(0, 3)).toEqual(["interpolate", ["linear"], ["zoom"]]);
    }
  });

  it("does not vary width by capacity", () => {
    expect(JSON.stringify(findLayer("pipelines-layer").paint["line-width"])).not.toContain("capacity");
  });
});

describe("selection", () => {
  it("pairs every point layer with a hidden selection ring", () => {
    for (const datasetId of POINT_DATASET_IDS) {
      const [base, ring] = getPointLayerDefinitions(datasetId);

      expect(base.id).toBe(`${datasetId}-layer`);
      expect(ring.id).toBe(`${datasetId}-selected-layer`);
      expect(ring.filter).toEqual(["==", ["get", "id"], ""]);
    }
  });

  it("lists an opacity update for every base layer, matching the layers' resting paint when cleared", () => {
    const updates = getSelectionPaintUpdates(null);

    expect(updates.map((update) => update.layerId)).toEqual([
      "pipelines-layer",
      "pipelines-schematic-layer",
      "pipelines-casing-layer",
      "fields-layer",
      "fields-layer",
      "terminals-layer",
      "refineries-layer"
    ]);

    for (const update of updates) {
      expect(findLayer(update.layerId).paint[update.property]).toEqual(update.value);
    }
  });

  it("dims every base layer while something is selected", () => {
    for (const update of getSelectionPaintUpdates("field-x")) {
      expect(JSON.stringify(update.value)).toContain("0.5");
    }
  });
});

describe("labels", () => {
  it("shows names as the reader zooms in, the dense field layer last", () => {
    const fontStack = ["Open Sans Regular"];

    expect(getLabelLayerDefinition("refineries", fontStack).minzoom).toBe(5.5);
    expect(getLabelLayerDefinition("fields", fontStack).minzoom).toBe(7.5);
    expect(getLabelLayerDefinition("fields", fontStack).layout?.["text-font"]).toEqual(fontStack);
  });

  it("draws refineries above terminals above fields", () => {
    expect(POINT_DATASET_IDS).toEqual(["fields", "terminals", "refineries"]);
  });
});

describe("showing and hiding unmapped routes", () => {
  it("shows the dashed layer and leaves every pipeline clickable by default", () => {
    expect(getUnmappedRouteUpdates(true)).toEqual({
      filters: [{ filter: null, layerId: "pipelines-hit-layer" }],
      layout: [{ layerId: "pipelines-schematic-layer", property: "visibility", value: "visible" }]
    });
  });

  it("hides the dashed layer and stops its stretches being hit when switched off", () => {
    expect(getUnmappedRouteUpdates(false)).toEqual({
      filters: [{ filter: ["==", ["get", "isRouteMapped"], true], layerId: "pipelines-hit-layer" }],
      layout: [{ layerId: "pipelines-schematic-layer", property: "visibility", value: "none" }]
    });
  });

  it("highlights the whole hovered pipeline, or only its mapped stretches while the joins are hidden", () => {
    expect(getPipelineHoverFilter("p1", true)).toEqual(["==", ["get", "id"], "p1"]);
    expect(getPipelineHoverFilter("p1", false)).toEqual([
      "all",
      ["==", ["get", "id"], "p1"],
      ["==", ["get", "isRouteMapped"], true]
    ]);
    expect(getPipelineHoverFilter(null, true)).toEqual(["==", ["get", "id"], ""]);
  });
});
