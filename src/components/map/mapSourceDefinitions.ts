import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

export type GeoJsonPayload = FeatureCollection<Geometry, GeoJsonProperties>;

export function createPointSourceDefinition(data: GeoJsonPayload) {
  return {
    data,
    type: "geojson" as const
  };
}

export function createLineSourceDefinition(data: GeoJsonPayload) {
  return {
    data,
    type: "geojson" as const
  };
}
