export interface MapLineLayerDefinition {
  filter?: unknown[];
  id: string;
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
  source: string;
  type: "line";
}

const PIPELINE_COLOR_EXPRESSION = [
  "match",
  ["get", "hydrocarbon"],
  "crude_oil",
  "#FF5722",
  "natural_gas",
  "#FF8C00",
  "ngl",
  "#FFB74D",
  "products",
  "#FFCC80",
  "#FFFFFF"
];

// Applied to the high-confidence (surveyed) layer only. Low-confidence
// schematic routes are rendered separately with a flat dim opacity.
const PIPELINE_OPACITY_EXPRESSION = [
  "match",
  ["get", "status"],
  "construction",
  0.44,
  "proposed",
  0.4,
  "planned",
  0.48,
  0.72
];

const PIPELINE_WIDTH_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "capacity_boed"], 0],
  0,
  0.9,
  500000,
  1.8,
  5000000,
  3.4
];

function emptySelectionFilter(): unknown[] {
  return ["==", ["get", "id"], ""];
}

function roundedLineLayout(): Record<string, string> {
  return {
    "line-cap": "round",
    "line-join": "round"
  };
}

export function getPipelineLayerDefinitions(sourceId: string): MapLineLayerDefinition[] {
  return [
    {
      // Casing only runs under surveyed routes. Schematic lines don't get a
      // black casing because we want them visually recessive.
      filter: ["!=", ["get", "geometryConfidence"], "low"],
      id: "pipelines-casing-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-blur": 0.1,
        "line-color": "#020202",
        "line-opacity": 0.74,
        "line-width": ["+", PIPELINE_WIDTH_EXPRESSION, 1.4]
      },
      source: sourceId,
      type: "line"
    },
    {
      filter: ["!=", ["get", "geometryConfidence"], "low"],
      id: "pipelines-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-blur": 0.3,
        "line-color": PIPELINE_COLOR_EXPRESSION,
        "line-opacity": PIPELINE_OPACITY_EXPRESSION,
        "line-width": PIPELINE_WIDTH_EXPRESSION
      },
      source: sourceId,
      type: "line"
    },
    {
      // Schematic / low-confidence routes: dashed, dim, no casing. These are
      // GEM endpoint-only records where we can't trust the drawn path.
      filter: ["==", ["get", "geometryConfidence"], "low"],
      id: "pipelines-schematic-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": PIPELINE_COLOR_EXPRESSION,
        "line-dasharray": [2, 2],
        "line-opacity": 0.32,
        "line-width": PIPELINE_WIDTH_EXPRESSION
      },
      source: sourceId,
      type: "line"
    },
    {
      filter: emptySelectionFilter(),
      id: "pipelines-hover-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-blur": 0.12,
        "line-color": "#FFE0B2",
        "line-opacity": 1,
        "line-width": ["+", PIPELINE_WIDTH_EXPRESSION, 1.2]
      },
      source: sourceId,
      type: "line"
    },
    {
      id: "pipelines-hit-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": "#FFFFFF",
        "line-opacity": 0.01,
        "line-width": ["+", PIPELINE_WIDTH_EXPRESSION, 9]
      },
      source: sourceId,
      type: "line"
    },
    {
      // Single thin amber outline marking the selected pipeline. The
      // previous halo+pulse was visually busy; selection is now quiet
      // and paired with spotlight dimming on the rest of the network.
      filter: emptySelectionFilter(),
      id: "pipelines-selected-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": "#FF8C00",
        "line-opacity": 1,
        "line-width": ["+", PIPELINE_WIDTH_EXPRESSION, 2]
      },
      source: sourceId,
      type: "line"
    }
  ];
}

export function getChokepointLayerDefinitions(sourceId: string): MapLineLayerDefinition[] {
  return [
    {
      id: "chokepoints-casing-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": "#020202",
        "line-opacity": 0.82,
        "line-width": 3.5
      },
      source: sourceId,
      type: "line"
    },
    {
      id: "chokepoints-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-blur": 0.15,
        "line-color": "#FF1744",
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.88,
        "line-width": 2
      },
      source: sourceId,
      type: "line"
    },
    {
      filter: emptySelectionFilter(),
      id: "chokepoints-hover-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": "#FFD180",
        "line-opacity": 1,
        "line-width": 3
      },
      source: sourceId,
      type: "line"
    },
    {
      id: "chokepoints-hit-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": "#FFFFFF",
        "line-opacity": 0.01,
        "line-width": 12
      },
      source: sourceId,
      type: "line"
    },
    {
      filter: emptySelectionFilter(),
      id: "chokepoints-selected-layer",
      layout: roundedLineLayout(),
      paint: {
        "line-color": "#FF8C00",
        "line-opacity": 1,
        "line-width": 4
      },
      source: sourceId,
      type: "line"
    }
  ];
}
