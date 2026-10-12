export type ViewMode = "map" | "table" | "reference" | "about";

export const VIEW_REGISTRY: ReadonlyArray<{ id: ViewMode; label: string }> = [
  { id: "map", label: "MAP" },
  { id: "table", label: "TABLE" },
  { id: "reference", label: "REFERENCE" },
  { id: "about", label: "ABOUT" }
];

export type ReferenceTab = "countries" | "operators" | "grades" | "glossary";

/** Where the Reference view is: which tab, and which entry is open in each. */
export interface ReferenceLocation {
  selectedIdByTab: Partial<Record<ReferenceTab, string>>;
  tab: ReferenceTab;
}

/** Open a Reference tab, optionally on a specific entry. */
export type NavigateReference = (tab: ReferenceTab, id?: string) => void;
