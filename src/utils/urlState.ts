import type { DatasetId } from "../types/Infrastructure";
import type { ReferenceTab, ViewMode } from "../types/View";

/**
 * What the address bar records: the view, and what is open in it. Enough
 * to share a link to an asset or a reference entry and to make the back
 * button work. Layer and energy toggles are not part of it.
 */
export interface UrlState {
  view: ViewMode;
  /** The asset selected on the map or in the table. */
  assetId?: string;
  /** The layer the table is showing. */
  layer?: DatasetId;
  /** The Reference tab, and the entry open in it. */
  tab?: ReferenceTab;
  entryId?: string;
}

const VIEWS: readonly ViewMode[] = ["map", "table", "reference", "about"];
const LAYERS: readonly DatasetId[] = ["refineries", "pipelines", "fields", "terminals"];
const TABS: readonly ReferenceTab[] = ["countries", "operators", "grades", "glossary"];

function oneOf<TValue extends string>(allowed: readonly TValue[], value: string | null): TValue | undefined {
  return allowed.find((candidate) => candidate === value);
}

/** Reads a query string such as `?view=reference&tab=countries&id=SA`. Anything unrecognised is ignored. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const view = oneOf(VIEWS, params.get("view")) ?? "map";
  const hasAssets = view === "map" || view === "table";

  return {
    view,
    ...(hasAssets && params.get("asset") ? { assetId: params.get("asset") as string } : {}),
    ...(view === "table" && oneOf(LAYERS, params.get("layer")) ? { layer: oneOf(LAYERS, params.get("layer")) } : {}),
    ...(view === "reference"
      ? {
          tab: oneOf(TABS, params.get("tab")) ?? "countries",
          ...(params.get("id") ? { entryId: params.get("id") as string } : {})
        }
      : {})
  };
}

/** The query string for a state, with only the parts that apply to its view. Empty for the opening map. */
export function buildUrlSearch(state: UrlState): string {
  const params = new URLSearchParams();
  const hasAssets = state.view === "map" || state.view === "table";

  if (state.view !== "map") {
    params.set("view", state.view);
  }

  if (state.view === "table" && state.layer) {
    params.set("layer", state.layer);
  }

  if (hasAssets && state.assetId) {
    params.set("asset", state.assetId);
  }

  if (state.view === "reference") {
    params.set("tab", state.tab ?? "countries");

    if (state.entryId) {
      params.set("id", state.entryId);
    }
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}
