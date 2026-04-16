import type { DataCadence, DataClassification } from "../types/DataSource";
import type { PricePoint } from "../types/Market";

// Historical Brent series for the situation-room historical chart.
// Distinct from eiaPrices.ts (which fetches 30 days for the market
// tape) because the chart wants years of context, not a tight window.
// Static-only seed for now — a future scripts/refreshBrentHistory.ts
// can pull ~5y from EIA v2 once VITE_EIA_API_KEY is provisioned.

const STATIC_SNAPSHOT_PATH = "/data/market/brent_historical_5y.json";

export interface BrentHistoricalSnapshot {
  asOf: string;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
  note?: string;
  frequency: "daily" | "weekly";
  series: { brent: PricePoint[] };
}

export async function loadBrentHistoricalSnapshot(): Promise<BrentHistoricalSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load Brent historical snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as BrentHistoricalSnapshot;
  const brent = normaliseSeries(payload.series?.brent);

  if (brent.length === 0) {
    throw new Error("Brent historical snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    cadence: "EOD",
    classification: "OBSERVED",
    source: payload.source,
    note: payload.note,
    frequency: payload.frequency ?? "weekly",
    series: { brent }
  };
}

function normaliseSeries(raw: PricePoint[] | undefined): PricePoint[] {
  if (!raw) {
    return [];
  }
  return raw
    .filter((point) => Boolean(point.date) && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
}
