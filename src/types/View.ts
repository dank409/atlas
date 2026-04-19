/**
 * Top-level navigation views, modelled on a Bloomberg-style terminal
 * where each tab is a dedicated workspace with its own center pane
 * and right rail module stack. The left-rail layer/filter column is
 * shared across all views.
 *
 * The set of views is intentionally frozen — no new top-level tabs
 * without a corresponding scope discussion. Sub-views that belong to
 * an existing category (e.g. REFERENCE > Voyages / Refineries / News
 * / Glossary) live under that tab rather than adding a new top-level
 * entry.
 */
export type ViewMode =
  | "map"
  | "markets"
  | "flows"
  | "chokes"
  | "events"
  | "models"
  | "ais"
  | "alerts"
  | "notes"
  | "reference"
  | "about"
  | "data";

/** REFERENCE tab has its own internal sub-nav. */
export type ReferenceSubView = "refineries" | "voyages" | "news" | "glossary";

export interface ViewDescriptor {
  id: ViewMode;
  label: string;
  /**
   * When true the view renders a full-width center pane with no
   * right-rail module stack (e.g. a table-only view like NOTES).
   * Defaults to false — most views use the standard 3-column shape.
   */
  fullWidth?: boolean;
}

export const VIEW_REGISTRY: ViewDescriptor[] = [
  { id: "map", label: "MAP" },
  { id: "markets", label: "MARKETS" },
  { id: "flows", label: "FLOWS" },
  { id: "chokes", label: "CHOKES" },
  { id: "events", label: "EVENTS" },
  { id: "models", label: "MODELS" },
  { id: "ais", label: "AIS" },
  { id: "alerts", label: "ALERTS" },
  { id: "notes", label: "NOTES" },
  { id: "reference", label: "REFERENCE" },
  { id: "about", label: "ABOUT" },
  { id: "data", label: "DATA" }
];
