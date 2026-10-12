import type { DatasetCatalogEntry } from "../types/Infrastructure";

/** Who publishes the map layers, for the short credit lines. */
export const MAP_DATA_SOURCES = "GLOBAL ENERGY MONITOR · EDF OGIM · OPENSTREETMAP";

// Static half of the layer catalog. Source, licence, download date and
// record count are read from each data file's `_metadata` block at load
// time (see `workspaceData.ts`) so they can never drift from the data.
export const DATASET_CATALOG_SEED: Array<Pick<DatasetCatalogEntry, "id" | "title">> = [
  { id: "refineries", title: "REFINERIES" },
  { id: "pipelines", title: "OIL & GAS PIPELINES" },
  { id: "fields", title: "OIL & GAS FIELDS" },
  { id: "terminals", title: "LNG TERMINALS" }
];
