// Curated outage / supply-shock events surfaced on the historical Brent
// chart and the map outage layer. This is CLAUDE.md P0 #15 — the time
// dimension that lets a trader connect "what broke" to "did the curve
// see it." The JSON that hydrates this lives at
// public/data/events/outages.json.

export type OutageSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type OutageCategory =
  | "attack"
  | "accident"
  | "maintenance"
  | "sanctions"
  | "weather"
  | "labor";

export interface OutagePriceReaction {
  /** Brent % move inside `windowHours` after the event. Signed. */
  brentChangePct: number;
  windowHours: number;
}

export interface OutageEvent {
  id: string;
  /** ISO 8601 date (day resolution is enough for a 5y chart overlay). */
  date: string;
  name: string;
  country: string;
  /**
   * Optional InfrastructureAsset id. When present the map outage layer
   * anchors the event icon to that asset's coordinates. When absent the
   * event is chart-only (and activity-log only).
   */
  assetId?: string;
  severity: OutageSeverity;
  category: OutageCategory;
  /** Nameplate volume removed, bpd. Zero means "no physical loss". */
  outageVolumeBpd: number;
  durationDays: number;
  summary: string;
  /** False for ongoing shocks (sanctions regimes, persistent campaigns). */
  resolved: boolean;
  priceReaction?: OutagePriceReaction;
}

export interface OutageEventSnapshot {
  mode: "LIVE" | "STATIC_SNAPSHOT";
  asOf: string;
  source: string;
  note?: string;
  events: OutageEvent[];
}
