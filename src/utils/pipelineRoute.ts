import type { LineStringGeometry, MultiLineStringGeometry } from "../types/Infrastructure";

type Line = Array<[number, number]>;

// A stretch this long with no point along it is not a surveyed route: it
// is the source joining two places it knows the pipeline connects.
export const UNMAPPED_STRETCH_MIN_KM = 30;

export interface PipelineRoute {
  /** Stretches drawn along the pipeline's real route. */
  mapped: Line[];
  /** Straight joins between two places, where the route is not mapped. Two points each. */
  unmapped: Line[];
}

/**
 * Splits a pipeline's geometry into the stretches that follow its route and
 * the long straight joins that do not, so the map can draw the joins dashed.
 */
export function splitPipelineRoute(geometry: LineStringGeometry | MultiLineStringGeometry): PipelineRoute {
  const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  const route: PipelineRoute = { mapped: [], unmapped: [] };

  lines.forEach((line) => {
    let run: Line = line.slice(0, 1);

    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];

      if (distanceKm(start, end) >= UNMAPPED_STRETCH_MIN_KM) {
        if (run.length > 1) {
          route.mapped.push(run);
        }

        route.unmapped.push([start, end]);
        run = [end];
      } else {
        run.push(end);
      }
    }

    if (run.length > 1) {
      route.mapped.push(run);
    }
  });

  return route;
}

function distanceKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(toRadians(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(toRadians(lon2 - lon1) / 2) ** 2;

  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
