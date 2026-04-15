import type {
  BenchmarkQuote,
  CrudeMarketSummary,
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot,
  PricePoint
} from "../types/Market";

// Builds the derived market summary (latest Brent / WTI / DME Oman /
// Murban quotes + spreads) that the market tape and situation room
// surfaces consume. Extracted from the hook so it can be unit-tested
// without pulling React in.
//
// WTI is still computed because EIA ships it for free alongside Brent,
// but it is no longer surfaced on the primary market tape — see
// eiaPrices.ts header comment for the "why" (Middle East framing).

interface BuildSummaryArgs {
  crude: CrudePriceSnapshot;
  dmeOman?: DmeOmanSnapshot | null;
  murban?: MurbanSnapshot | null;
}

export function buildCrudeMarketSummary(
  argsOrSnapshot: CrudePriceSnapshot | BuildSummaryArgs
): CrudeMarketSummary | null {
  // Back-compat: accept a bare CrudePriceSnapshot so existing callers
  // that only pass Brent/WTI keep working until they upgrade.
  const args: BuildSummaryArgs =
    "crude" in argsOrSnapshot
      ? argsOrSnapshot
      : { crude: argsOrSnapshot };

  const brentQuote = buildBenchmarkQuote("BRENT", args.crude.series.brent);
  const wtiQuote = buildBenchmarkQuote("WTI", args.crude.series.wti);

  if (!brentQuote || !wtiQuote) {
    return null;
  }

  const dmeOmanQuote = args.dmeOman
    ? buildBenchmarkQuote("DME_OMAN", args.dmeOman.series.dmeOman)
    : null;
  const murbanQuote = args.murban
    ? buildBenchmarkQuote("MURBAN", args.murban.series.murban)
    : null;

  // Brent–Oman spread is the east-of-Suez arbitrage signal: positive
  // means Oman is trading at a discount and Gulf barrels are incentivised
  // west. Undefined when DME Oman is unavailable — callers must handle.
  const brentDmeOmanSpread =
    dmeOmanQuote !== null
      ? round2(brentQuote.value - dmeOmanQuote.value)
      : undefined;

  // Tape mode badge: the primary Gulf benchmark (DME Oman) wins if it
  // loaded. Brent may be LIVE via EIA, but the tape is framed around
  // Gulf crude — so if DME Oman is STATIC (which it currently always
  // is), the tape should say STATIC. Falls back to crude mode only when
  // the Gulf leg failed to load.
  const mode = args.dmeOman?.mode ?? args.crude.mode;

  return {
    asOf: args.crude.asOf || brentQuote.asOf,
    brent: brentQuote,
    wti: wtiQuote,
    dmeOman: dmeOmanQuote ?? undefined,
    murban: murbanQuote ?? undefined,
    spread: round2(wtiQuote.value - brentQuote.value),
    brentDmeOmanSpread,
    mode,
    source: args.crude.source
  };
}

function buildBenchmarkQuote(
  name: BenchmarkQuote["name"],
  series: PricePoint[]
): BenchmarkQuote | null {
  if (!series.length) {
    return null;
  }

  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const change = previous ? round2(latest.value - previous.value) : 0;
  const changePct = previous && previous.value !== 0 ? round2((change / previous.value) * 100) : 0;

  return {
    name,
    value: round2(latest.value),
    change,
    changePct,
    asOf: latest.date
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}

export function formatChange(change: number) {
  const sign = change > 0 ? "+" : change < 0 ? "" : "";
  return `${sign}${change.toFixed(2)}`;
}

export function formatChangePct(changePct: number) {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}

export function formatSpread(spread: number) {
  const sign = spread > 0 ? "+" : "";
  return `${sign}${spread.toFixed(2)}`;
}
