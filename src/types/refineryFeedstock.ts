// Intentionally camelCase filename, matching the convention the rest of
// src/types/ held before the rename pass. The prompt that introduced this
// file calls it out as a deliberate one-off deviation — do NOT PascalCase
// it in a follow-up without also updating the type-file rename prompt.

export interface RefineryFeedstockEntry {
  refineryId: string;
  /** [0, 1] — expert-curated Hormuz crude dependency score. */
  hormuzDependency: number;
  dominantGrades: string[];
  bypassAccessible: boolean;
  note: string;
}

export interface RefineryFeedstockSnapshot {
  mode: "LIVE" | "STATIC_SNAPSHOT";
  asOf: string;
  source: string;
  methodology: string;
  entries: RefineryFeedstockEntry[];
}
