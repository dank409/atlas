import {
  formatCadenceLabel,
  formatClassificationLabel,
  type DataCadence,
  type DataClassification
} from "../types/DataSource";
import type {
  BenchmarkQuote,
  BrentTimespreadSnapshot,
  BrentWtiSpreadHistory,
  CrudeMarketSummary,
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot,
  PricePoint
} from "../types/Market";
import type { IceBrentSettlementSnapshot } from "../types/IceSettlements";

interface BuildSummaryArgs {
  crude: CrudePriceSnapshot;
  dmeOman?: DmeOmanSnapshot | null;
  murban?: MurbanSnapshot | null;
}

export function buildCrudeMarketSummary(
  argsOrSnapshot: CrudePriceSnapshot | BuildSummaryArgs
): CrudeMarketSummary | null {
  const args: BuildSummaryArgs =
    "crude" in argsOrSnapshot ? argsOrSnapshot : { crude: argsOrSnapshot };

  const brentQuote = buildBenchmarkQuote("BRENT", args.crude.series.brent, args.crude);
  const wtiQuote = buildBenchmarkQuote("WTI", args.crude.series.wti, args.crude);

  if (!brentQuote || !wtiQuote) {
    return null;
  }

  const dmeOmanQuote = args.dmeOman
    ? buildBenchmarkQuote("DME_OMAN", args.dmeOman.series.dmeOman, args.dmeOman)
    : null;
  const murbanQuote = args.murban
    ? buildBenchmarkQuote("MURBAN", args.murban.series.murban, args.murban)
    : null;

  return {
    asOf: args.crude.asOf || brentQuote.asOf,
    brent: brentQuote,
    wti: wtiQuote,
    dmeOman: dmeOmanQuote ?? undefined,
    murban: murbanQuote ?? undefined,
    brentWtiSpread: round2(brentQuote.value - wtiQuote.value),
    brentDmeOmanSpread:
      dmeOmanQuote !== null ? round2(brentQuote.value - dmeOmanQuote.value) : undefined,
    cadence: args.crude.cadence,
    classification: args.crude.classification,
    source: args.crude.source
  };
}

export function buildBrentWtiSpreadHistory(
  snapshot: CrudePriceSnapshot
): BrentWtiSpreadHistory {
  const brentByDate = new Map(snapshot.series.brent.map((point) => [point.date, point.value]));
  const spreadSeries = snapshot.series.wti
    .filter((point) => brentByDate.has(point.date))
    .map((point) => ({
      date: point.date,
      value: round2((brentByDate.get(point.date) ?? 0) - point.value)
    }));

  return {
    asOf: snapshot.asOf,
    cadence: snapshot.cadence,
    classification: snapshot.classification,
    note: snapshot.note,
    source: snapshot.source,
    series: { brentWti: spreadSeries }
  };
}

export function buildBrentTimespreadSnapshot(
  snapshot: IceBrentSettlementSnapshot
): BrentTimespreadSnapshot | null {
  const m1 = snapshot.strip.find((point) => point.month === 1)?.priceUsd;
  const m2 = snapshot.strip.find((point) => point.month === 2)?.priceUsd;
  const m6 = snapshot.strip.find((point) => point.month === 6)?.priceUsd;
  const m12 = snapshot.strip.find((point) => point.month === 12)?.priceUsd;

  if (
    typeof m1 !== "number" ||
    typeof m2 !== "number" ||
    typeof m6 !== "number" ||
    typeof m12 !== "number"
  ) {
    return null;
  }

  const promptSpread = round2(m1 - m2);
  const m1MinusM12 = round2(m1 - m12);

  return {
    asOf: snapshot.asOf,
    cadence: snapshot.cadence,
    classification: snapshot.classification,
    note: snapshot.note,
    source: snapshot.source,
    m1MinusM2: promptSpread,
    m1MinusM6: round2(m1 - m6),
    m1MinusM12,
    structure:
      m1MinusM12 > 0.15 ? "BACKWARDATION" : m1MinusM12 < -0.15 ? "CONTANGO" : "FLAT"
  };
}

function buildBenchmarkQuote(
  name: BenchmarkQuote["name"],
  series: PricePoint[],
  snapshot: Pick<CrudePriceSnapshot, "cadence" | "classification" | "source">
): BenchmarkQuote | null {
  if (!series.length) {
    return null;
  }

  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const change = previous ? round2(latest.value - previous.value) : 0;
  const changePct =
    previous && previous.value !== 0 ? round2((change / previous.value) * 100) : 0;

  return {
    name,
    asOf: latest.date,
    cadence: snapshot.cadence,
    classification: snapshot.classification,
    source: snapshot.source,
    value: round2(latest.value),
    change,
    changePct
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

export function formatDataStamp(options: {
  asOf: string;
  cadence: DataCadence;
  classification: DataClassification;
  source: string;
}) {
  return [
    formatClassificationLabel(options.classification),
    formatCadenceLabel(options.cadence),
    options.source,
    options.asOf
  ].join(" | ");
}
