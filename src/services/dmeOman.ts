import type { DmeOmanSnapshot, PricePoint } from "../types/Market";

// DME (Dubai Mercantile Exchange) Oman M1 settlements. The published
// DME daily settlement file is a PDF behind an IP-whitelisted CDN — no
// free public JSON endpoint — so this service is static-only by design.
// Mode is always STATIC_SNAPSHOT and the tape badges it as such per
// CLAUDE.md Data Integrity Rule #6. When a future deployment wires up
// a scraper or licensed feed, add a `loadLive*` path here mirroring the
// eiaPrices.ts shape and flip mode to LIVE.

const STATIC_SNAPSHOT_PATH = "/data/market/dme_oman_30d.json";

export async function loadDmeOmanSnapshot(): Promise<DmeOmanSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load DME Oman snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as DmeOmanSnapshot;
  const series = normaliseSeries(payload.series?.dmeOman);

  if (series.length === 0) {
    throw new Error("DME Oman snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    mode: "STATIC_SNAPSHOT",
    series: { dmeOman: series },
    source: payload.source,
    note: payload.note
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
