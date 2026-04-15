import type { MurbanSnapshot, PricePoint } from "../types/Market";

// ICE Futures Abu Dhabi (IFAD) Murban M1 settlements. IFAD publishes an
// end-of-day settlement summary on their public page but there is no
// free JSON feed, so — same pattern as dmeOman.ts and eiaPrices.ts
// static-only fallback — we load a checked-in snapshot and surface mode
// STATIC_SNAPSHOT explicitly. When a licensed or scraped live feed lands,
// add a `loadLive*` path mirroring the eiaPrices.ts LIVE branch.

const STATIC_SNAPSHOT_PATH = "/data/market/murban_30d.json";

export async function loadMurbanSnapshot(): Promise<MurbanSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load Murban snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as MurbanSnapshot;
  const series = normaliseSeries(payload.series?.murban);

  if (series.length === 0) {
    throw new Error("Murban snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    mode: "STATIC_SNAPSHOT",
    series: { murban: series },
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
