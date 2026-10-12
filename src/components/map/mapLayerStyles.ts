import type { DatasetId } from "../../types/Infrastructure";
import { ENERGY_COLORS } from "../../utils/assetEnergy";

// Every map layer is defined here as plain data. The encoding is:
//
//   shape   = what kind of asset it is (diamond refinery, triangle LNG
//             terminal, dot field, line pipeline)
//   colour  = what energy it handles (see `ENERGY_COLORS`)
//   opacity = faded when the source says it is not operating
//   size    = capacity, only where the source reports it for nearly
//             every asset (refineries, LNG terminals)
//
// Each GeoJSON feature carries `energy`, `isOperating` and `sizeValue`
// properties (set in MapView) that these expressions read. Pipeline
// features also carry `isRouteMapped`.

export type PointDatasetId = Exclude<DatasetId, "pipelines">;

/** Draw order, bottom to top. */
export const POINT_DATASET_IDS: readonly PointDatasetId[] = ["fields", "terminals", "refineries"];

export const REFINERY_ICON_ID = "atlas-refinery";
export const TERMINAL_ICON_ID = "atlas-lng-terminal";

// White, not the amber accent: amber is the crude-oil colour on this map.
const SELECTION_COLOR = "#FFFFFF";

// Opacity for everything except the selected asset while a selection is active.
const DIMMED_OPACITY = 0.5;

export interface MapLayerDefinition {
  filter?: unknown[];
  id: string;
  layout?: Record<string, unknown>;
  minzoom?: number;
  paint: Record<string, unknown>;
  source: string;
  type: "circle" | "line" | "symbol";
}

const ENERGY_COLOR_EXPRESSION = [
  "match",
  ["get", "energy"],
  "oil",
  ENERGY_COLORS.oil,
  "gas",
  ENERGY_COLORS.gas,
  "ngl",
  ENERGY_COLORS.ngl,
  ENERGY_COLORS.mixed
];

const NO_FEATURE_FILTER: unknown[] = ["==", ["get", "id"], ""];
const ROUTE_MAPPED_FILTER: unknown[] = ["==", ["get", "isRouteMapped"], true];
const ROUTE_UNMAPPED_FILTER: unknown[] = ["==", ["get", "isRouteMapped"], false];

/**
 * Opacity for a base layer: operating assets at `operating`, everything
 * else faded. While something is selected, the selection shows at full
 * strength and the rest of the map is dimmed.
 */
export function getOpacityExpression(operating: number, selectedAssetId: string | null): unknown {
  if (selectedAssetId) {
    return ["case", ["==", ["get", "id"], selectedAssetId], 1, DIMMED_OPACITY];
  }

  return ["case", ["get", "isOperating"], operating, operating * 0.45];
}

// Icon scale by capacity on a square-root scale, so the largest sites
// do not swamp the map. 1 = 24px. `sizeValue` is bpd for refineries
// (sqrt of 1,000,000 = 1000) and mtpa for terminals (sqrt of 64 = 8).
const ICON_SIZE_EXPRESSIONS: Record<"refineries" | "terminals", unknown[]> = {
  refineries: ["interpolate", ["linear"], ["sqrt", ["get", "sizeValue"]], 0, 0.5, 1000, 1.3],
  terminals: ["interpolate", ["linear"], ["sqrt", ["get", "sizeValue"]], 0, 0.55, 8, 1.15]
};

const FIELD_RADIUS = 3.5;

// Pipelines are one width: capacity is reported for only about half of
// them, so varying the width would make missing data look like a thin pipe.
// Mapbox only allows `zoom` at the top level of an expression, so the
// casing / highlight variants are built here rather than added on later.
function pipelineWidth(extra = 0): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 4, 1.1 + extra, 8, 2.4 + extra];
}

const ROUND_LINE_LAYOUT = {
  "line-cap": "round",
  "line-join": "round"
};

export function getPipelineLayerDefinitions(): MapLayerDefinition[] {
  const source = "pipelines";

  return [
    {
      // Casing only runs under mapped routes; the dashed joins stay recessive.
      filter: ROUTE_MAPPED_FILTER,
      id: "pipelines-casing-layer",
      layout: ROUND_LINE_LAYOUT,
      paint: {
        "line-color": "#020202",
        "line-opacity": 0.7,
        "line-width": pipelineWidth(1.4)
      },
      source,
      type: "line"
    },
    {
      filter: ROUTE_MAPPED_FILTER,
      id: "pipelines-layer",
      layout: ROUND_LINE_LAYOUT,
      paint: {
        "line-color": ENERGY_COLOR_EXPRESSION,
        "line-opacity": getOpacityExpression(0.85, null),
        "line-width": pipelineWidth()
      },
      source,
      type: "line"
    },
    {
      // Straight joins between two places, where the route is not mapped.
      filter: ROUTE_UNMAPPED_FILTER,
      id: "pipelines-schematic-layer",
      paint: {
        "line-color": ENERGY_COLOR_EXPRESSION,
        "line-dasharray": [2, 2],
        "line-opacity": getOpacityExpression(0.6, null),
        "line-width": pipelineWidth()
      },
      source,
      type: "line"
    },
    {
      filter: NO_FEATURE_FILTER,
      id: "pipelines-hover-layer",
      layout: ROUND_LINE_LAYOUT,
      paint: {
        "line-color": SELECTION_COLOR,
        "line-opacity": 0.6,
        "line-width": pipelineWidth(1.5)
      },
      source,
      type: "line"
    },
    {
      filter: NO_FEATURE_FILTER,
      id: "pipelines-selected-layer",
      layout: ROUND_LINE_LAYOUT,
      paint: {
        "line-color": SELECTION_COLOR,
        "line-width": pipelineWidth(2)
      },
      source,
      type: "line"
    },
    {
      // Invisible wide line so thin pipelines are easy to hover and click.
      id: "pipelines-hit-layer",
      layout: ROUND_LINE_LAYOUT,
      paint: {
        "line-color": "#FFFFFF",
        "line-opacity": 0.01,
        "line-width": pipelineWidth(9)
      },
      source,
      type: "line"
    }
  ];
}

function getSelectionRingDefinition(datasetId: PointDatasetId): MapLayerDefinition {
  // Icons are 24px at size 1, so half the icon is 12px per unit of size.
  const radius = datasetId === "fields" ? FIELD_RADIUS + 5 : ["+", ["*", ICON_SIZE_EXPRESSIONS[datasetId], 12], 3];

  return {
    filter: NO_FEATURE_FILTER,
    id: `${datasetId}-selected-layer`,
    paint: {
      "circle-color": "rgba(0, 0, 0, 0)",
      "circle-radius": radius,
      "circle-stroke-color": SELECTION_COLOR,
      "circle-stroke-width": 2
    },
    source: datasetId,
    type: "circle"
  };
}

export function getPointLayerDefinitions(datasetId: PointDatasetId): MapLayerDefinition[] {
  if (datasetId === "fields") {
    return [
      {
        id: "fields-layer",
        paint: {
          "circle-color": ENERGY_COLOR_EXPRESSION,
          "circle-opacity": getOpacityExpression(0.9, null),
          "circle-radius": FIELD_RADIUS,
          "circle-stroke-color": "#050505",
          "circle-stroke-opacity": getOpacityExpression(0.9, null),
          "circle-stroke-width": 1
        },
        source: "fields",
        type: "circle"
      },
      getSelectionRingDefinition("fields")
    ];
  }

  return [
    {
      id: `${datasetId}-layer`,
      layout: {
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-image": datasetId === "refineries" ? REFINERY_ICON_ID : TERMINAL_ICON_ID,
        // LNG import terminals point down, export terminals point up.
        "icon-rotate": datasetId === "terminals" ? ["match", ["get", "terminalRole"], "import", 180, 0] : 0,
        "icon-size": ICON_SIZE_EXPRESSIONS[datasetId],
        // Draw small sites over large ones so they stay clickable.
        "symbol-sort-key": ["-", 0, ["get", "sizeValue"]]
      },
      paint: {
        "icon-opacity": getOpacityExpression(1, null)
      },
      source: datasetId,
      type: "symbol"
    },
    getSelectionRingDefinition(datasetId)
  ];
}

// Names appear on their own as you zoom in, densest layer last.
const LABEL_MIN_ZOOM: Record<PointDatasetId, number> = {
  fields: 7.5,
  refineries: 5.5,
  terminals: 5.5
};

export function getLabelLayerDefinition(datasetId: PointDatasetId, fontStack: string[]): MapLayerDefinition {
  return {
    id: `${datasetId}-label-layer`,
    layout: {
      "text-anchor": "top",
      "text-field": ["get", "name"],
      "text-font": fontStack,
      "text-max-width": 12,
      "text-offset": [0, datasetId === "fields" ? 0.6 : 1.2],
      "text-size": 10
    },
    minzoom: LABEL_MIN_ZOOM[datasetId],
    paint: {
      "text-color": "#E0E0E0",
      "text-halo-color": "#000000",
      "text-halo-width": 1.2
    },
    source: datasetId,
    type: "symbol"
  };
}

/**
 * Layer writes that show or hide the dashed joins. Hidden joins are also
 * taken out of hover and click. A selected pipeline still shows whole.
 */
export function getUnmappedRouteUpdates(showUnmappedRoutes: boolean): {
  filters: Array<{ filter: unknown[] | null; layerId: string }>;
  layout: Array<{ layerId: string; property: string; value: string }>;
} {
  return {
    filters: [{ filter: showUnmappedRoutes ? null : ROUTE_MAPPED_FILTER, layerId: "pipelines-hit-layer" }],
    layout: [
      { layerId: "pipelines-schematic-layer", property: "visibility", value: showUnmappedRoutes ? "visible" : "none" }
    ]
  };
}

/** Filter for the hover highlight: the hovered pipeline, minus its joins while those are hidden. */
export function getPipelineHoverFilter(pipelineId: string | null, showUnmappedRoutes: boolean): unknown[] {
  const isHovered = ["==", ["get", "id"], pipelineId ?? ""];

  return showUnmappedRoutes ? isHovered : ["all", isHovered, ROUTE_MAPPED_FILTER];
}

/** Paint writes that (re)apply the selection state to every base layer. */
export function getSelectionPaintUpdates(
  selectedAssetId: string | null
): Array<{ layerId: string; property: string; value: unknown }> {
  return [
    { layerId: "pipelines-layer", property: "line-opacity", value: getOpacityExpression(0.85, selectedAssetId) },
    {
      layerId: "pipelines-schematic-layer",
      property: "line-opacity",
      value: getOpacityExpression(0.6, selectedAssetId)
    },
    { layerId: "pipelines-casing-layer", property: "line-opacity", value: selectedAssetId ? DIMMED_OPACITY : 0.7 },
    { layerId: "fields-layer", property: "circle-opacity", value: getOpacityExpression(0.9, selectedAssetId) },
    {
      layerId: "fields-layer",
      property: "circle-stroke-opacity",
      value: getOpacityExpression(0.9, selectedAssetId)
    },
    { layerId: "terminals-layer", property: "icon-opacity", value: getOpacityExpression(1, selectedAssetId) },
    { layerId: "refineries-layer", property: "icon-opacity", value: getOpacityExpression(1, selectedAssetId) }
  ];
}
