import type {
  IceBrentSettlementSnapshot,
  IceBrentStripPoint
} from "../types/IceSettlements";

// ICE Futures Europe publishes end-of-day Brent settlements as a PDF that
// is not freely API-addressable. A future path would either
// license an ICE data feed or scrape the public settlement summary
// during a scheduled refresh job. Until that is stood up we load a
// checked-in snapshot and flag it as curated EOD. An optional
// VITE_ICE_SETTLEMENTS_URL env
// override is honoured so a future deployment can swap in a live JSON
// mirror without touching this file.
//
// Rule from CLAUDE.md #6: downstream surfaces MUST render cadence
// explicitly so the user is never tricked into thinking yesterday's
// settles are today's tape.

const STATIC_SNAPSHOT_PATH = "/data/market/ice_brent_settlements.json";
const EXPECTED_STRIP_LENGTH = 12;

export async function loadIceBrentSettlementSnapshot(): Promise<IceBrentSettlementSnapshot> {
  const liveUrl = import.meta.env.VITE_ICE_SETTLEMENTS_URL;

  if (typeof liveUrl === "string" && liveUrl.length > 0) {
    try {
      return await loadLiveIceSettlements(liveUrl);
    } catch {
      // Live fetch failed — fall through to the static snapshot so the
      // chart still has something to plot. The fallback remains clearly
      // labeled as curated end-of-day data rather than live telemetry.
    }
  }

  return loadStaticIceSettlements();
}

async function loadLiveIceSettlements(
  url: string
): Promise<IceBrentSettlementSnapshot> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ICE live feed fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as IceBrentSettlementSnapshot;
  const strip = normaliseStrip(payload.strip);

  return {
    asOf: payload.asOf,
    cadence: "EOD",
    classification: "OBSERVED",
    strip,
    source: payload.source,
    note: payload.note
  };
}

async function loadStaticIceSettlements(): Promise<IceBrentSettlementSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load static ICE settlements: ${response.status}`);
  }

  const payload = (await response.json()) as IceBrentSettlementSnapshot;
  const strip = normaliseStrip(payload.strip);

  return {
    asOf: payload.asOf,
    cadence: "EOD",
    classification: "CURATED",
    strip,
    source: payload.source,
    note: payload.note
  };
}

function normaliseStrip(raw: IceBrentStripPoint[] | undefined): IceBrentStripPoint[] {
  if (!raw || raw.length !== EXPECTED_STRIP_LENGTH) {
    throw new Error(
      `ICE strip must have exactly ${EXPECTED_STRIP_LENGTH} contract months`
    );
  }

  // Sort defensively so plotting math can trust the order.
  return [...raw].sort((left, right) => left.month - right.month);
}
