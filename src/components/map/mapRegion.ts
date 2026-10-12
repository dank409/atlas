import type { InfrastructureAsset } from "../../types/Infrastructure";

export type MapBounds = [[number, number], [number, number]];

// The region the map is about: Egypt to eastern Iran, Yemen to Turkey.
// The map opens fitted to it.
export const REGION_BOUNDS: MapBounds = [
  [25, 12],
  [63, 42]
];

// How much further than the opening view the map can be zoomed out.
const ZOOM_OUT_MARGIN = 1.2;

/**
 * The furthest the map may show in a panel of the given size: the region,
 * grown to the panel's shape, plus a small margin. Given to Mapbox as
 * `maxBounds`, which stops both zooming out and panning past it, so the
 * map stays on the Middle East whatever the screen.
 */
export function getMaxBounds(panelWidth: number, panelHeight: number): MapBounds {
  const [[west, south], [east, north]] = REGION_BOUNDS;
  // An unmeasured panel (zero size) is treated as square.
  const aspectRatio = panelWidth > 0 && panelHeight > 0 ? panelWidth / panelHeight : 1;
  const regionWidth = east - west;
  const regionHeight = toMercatorY(north) - toMercatorY(south);
  // The panel shows the whole region, so one of its sides matches the
  // region and the other shows extra.
  const isHeightLimited = regionWidth / regionHeight < aspectRatio;
  const width = (isHeightLimited ? regionHeight * aspectRatio : regionWidth) * ZOOM_OUT_MARGIN;
  const height = (isHeightLimited ? regionHeight : regionWidth / aspectRatio) * ZOOM_OUT_MARGIN;
  const centerX = (west + east) / 2;
  const centerY = (toMercatorY(south) + toMercatorY(north)) / 2;

  return [
    [centerX - width / 2, toLatitude(centerY - height / 2)],
    [centerX + width / 2, toLatitude(centerY + height / 2)]
  ];
}

// A single site, or sites in a row, still need a box with some area.
const MIN_SPAN_DEGREES = 1;

/**
 * The box that frames a set of assets, for zooming the map to a filter.
 * Sites decide it: a country's pipelines can run far beyond where its
 * refineries, fields and terminals are. Pipelines are used only when there
 * are no sites. Null when there is nothing to frame.
 */
export function getAssetsBounds(assets: InfrastructureAsset[]): MapBounds | null {
  const sites = assets.flatMap((asset): Array<[number, number]> =>
    asset.assetKind === "pipeline" ? [] : [[asset.lon, asset.lat]]
  );
  const points =
    sites.length > 0
      ? sites
      : assets.flatMap((asset) =>
          asset.assetKind !== "pipeline"
            ? []
            : asset.geometry.type === "LineString"
              ? asset.geometry.coordinates
              : asset.geometry.coordinates.flat()
        );

  if (points.length === 0) {
    return null;
  }

  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const [west, east] = [Math.min(...longitudes), Math.max(...longitudes)];
  const [south, north] = [Math.min(...latitudes), Math.max(...latitudes)];

  return [
    [widen(west, east, -1), widen(south, north, -1)],
    [widen(west, east, 1), widen(south, north, 1)]
  ];
}

/** One edge of a span, pushed out from the middle when the span is too thin to frame. */
function widen(low: number, high: number, side: -1 | 1) {
  const padding = Math.max(0, MIN_SPAN_DEGREES - (high - low)) / 2;

  return side === -1 ? low - padding : high + padding;
}

// Web Mercator stretches latitude; these convert to and from its vertical
// scale, in the same degrees as longitude, so widths and heights compare.
function toMercatorY(latitude: number) {
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
}

function toLatitude(mercatorY: number) {
  return (360 / Math.PI) * Math.atan(Math.exp((mercatorY * Math.PI) / 180)) - 90;
}
