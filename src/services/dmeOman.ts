import type { DmeOmanSnapshot, PricePoint } from "../types/Market";

// DME (Dubai Mercantile Exchange) Oman M1 settlements. The published
// DME daily settlement file is a PDF behind an IP-whitelisted CDN — no
// free public JSON endpoint — so this service is static-only by design.
// The snapshot is explicitly marked curated rather than pretending to be
// a client-side live feed.

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
    cadence: "CURATED",
    classification: "CURATED",
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
