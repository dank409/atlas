import type { CrudePriceSnapshot, PricePoint } from "../types/Market";

// Per docs/DATA_SOURCES.md section 3 the EIA daily spot-price endpoint
// is /v2/petroleum/pri/spt/data/. We support an API fetch when
// VITE_EIA_API_KEY is provisioned, and fall back to the checked-in
// static snapshot so the UI always has something to render. Every code
// path produces explicit cadence/classification metadata.

const STATIC_SNAPSHOT_PATH = "/data/market/crude_prices_30d.json";
const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/spt/data/";
const EIA_PRODUCT_BRENT = "EPCBRENT";
const EIA_PRODUCT_WTI = "EPCWTI";
const EIA_LENGTH = 30;

interface EiaPricePayload {
  response?: {
    data?: Array<{ period?: string; value?: number | string | null }>;
  };
}

export async function loadCrudePriceSnapshot(): Promise<CrudePriceSnapshot> {
  const apiKey = import.meta.env.VITE_EIA_API_KEY;

  if (apiKey) {
    try {
      return await loadLiveCrudePrices(apiKey);
    } catch {
      // Live fetch failed — fall through to the static snapshot. Keeping
      // the terminal responsive matters more than surfacing the raw error
      // here; the status bar still shows STATIC mode so the user knows.
    }
  }

  return loadStaticCrudePrices();
}

async function loadLiveCrudePrices(apiKey: string): Promise<CrudePriceSnapshot> {
  const [brent, wti] = await Promise.all([
    fetchEiaSeries(apiKey, EIA_PRODUCT_BRENT),
    fetchEiaSeries(apiKey, EIA_PRODUCT_WTI)
  ]);

  if (!brent.length || !wti.length) {
    throw new Error("EIA returned empty price series");
  }

  const asOf = brent[brent.length - 1]?.date ?? wti[wti.length - 1]?.date ?? "";

  return {
    asOf,
    cadence: "EOD",
    classification: "OBSERVED",
    series: { brent, wti },
    source: "EIA v2 petroleum/pri/spt"
  };
}

async function fetchEiaSeries(apiKey: string, product: string): Promise<PricePoint[]> {
  const url = new URL(EIA_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "daily");
  url.searchParams.append("data[0]", "value");
  url.searchParams.append("facets[product][]", product);
  url.searchParams.append("sort[0][column]", "period");
  url.searchParams.append("sort[0][direction]", "desc");
  url.searchParams.set("length", String(EIA_LENGTH));

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`EIA fetch failed for ${product}: ${response.status}`);
  }

  const payload = (await response.json()) as EiaPricePayload;
  const rows = payload.response?.data ?? [];

  return rows
    .map((row) => ({
      date: row.period ?? "",
      // Null/undefined must become NaN so the finite-value filter drops them.
      // Number(null) === 0 in JS, so we can't rely on raw coercion here — an
      // unpublished-day row from EIA (`value: null`) was previously slipping
      // through as $0.00 and poisoning the latest-price selector downstream.
      value:
        typeof row.value === "number"
          ? row.value
          : row.value == null
            ? NaN
            : Number(row.value)
    }))
    .filter((point) => point.date && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function loadStaticCrudePrices(): Promise<CrudePriceSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load static crude snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as CrudePriceSnapshot;

  if (!payload.series?.brent?.length || !payload.series?.wti?.length) {
    throw new Error("Static crude snapshot is empty");
  }

  return {
    ...payload,
    cadence: "EOD",
    classification: "OBSERVED"
  };
}
