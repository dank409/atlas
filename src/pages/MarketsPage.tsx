import { useMemo } from "react";
import { Panel } from "../components/common/Panel";
import { PriceGridModule } from "../components/market/PriceGridModule";
import { SpreadsModule } from "../components/market/SpreadsModule";
import { TermCurveModule } from "../components/market/TermCurveModule";
import { Sparkline } from "../components/market/Sparkline";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary,
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot,
  PricePoint
} from "../types/Market";
import type { IceBrentSettlementSnapshot } from "../types/IceSettlements";
import styles from "./MarketsPage.module.css";

interface MarketsPageProps {
  summary: CrudeMarketSummary | null;
  brentWtiSnapshot: CrudePriceSnapshot | null;
  dmeOmanSnapshot: DmeOmanSnapshot | null;
  murbanSnapshot: MurbanSnapshot | null;
  iceSnapshot: IceBrentSettlementSnapshot | null;
  timespreads: BrentTimespreadSnapshot | null;
  /** Brent historical weekly series used for the correlations/seasonality panes. */
  brentHistoricalSeries: PricePoint[];
  mode: "LIVE" | "STATIC_SNAPSHOT";
}

/**
 * MARKETS view — a dense grid of price / spread / curve modules, plus
 * honest stubs for the panels that require data we don't yet have
 * wired (freight rates, refinery margins, FX, rig counts, volatility).
 *
 * Lays out three columns at desktop width:
 *   col 1: CRUDE · SPOT + SPREADS
 *   col 2: TERM STRUCTURE + CORRELATIONS
 *   col 3: SEASONALITY + awaiting-feed placeholders
 *
 * Collapses to two columns at narrower widths via the CSS grid.
 */
export function MarketsPage({
  summary,
  brentWtiSnapshot,
  dmeOmanSnapshot,
  murbanSnapshot,
  iceSnapshot,
  timespreads,
  brentHistoricalSeries,
  mode
}: MarketsPageProps) {
  const correlations = useMemo(
    () => computeCorrelations(brentWtiSnapshot, dmeOmanSnapshot, murbanSnapshot),
    [brentWtiSnapshot, dmeOmanSnapshot, murbanSnapshot]
  );

  const seasonality = useMemo(
    () => computeSeasonalityBands(brentHistoricalSeries),
    [brentHistoricalSeries]
  );

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <div className={styles.col}>
          <PriceGridModule
            brentWtiSnapshot={brentWtiSnapshot}
            dmeOmanSnapshot={dmeOmanSnapshot}
            mode={mode}
            murbanSnapshot={murbanSnapshot}
            summary={summary}
          />
          <SpreadsModule summary={summary} timespreads={timespreads} />
        </div>

        <div className={styles.col}>
          <TermCurveModule snapshot={iceSnapshot} timespreads={timespreads} />
          <Panel badge="90D ROLLING" title="CORRELATIONS">
            {correlations ? (
              <table className={styles.corrTable}>
                <thead>
                  <tr>
                    <th />
                    {correlations.symbols.map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlations.symbols.map((row, i) => (
                    <tr key={row}>
                      <th scope="row" className={styles.corrRowHead}>{row}</th>
                      {correlations.symbols.map((_col, j) => {
                        const value = correlations.matrix[i][j];
                        return (
                          <td className={styles.corrCell} key={`${row}-${j}`}>
                            <span
                              className={styles.corrPill}
                              style={{
                                background: correlationTint(value)
                              }}
                            >
                              {value.toFixed(2)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>INSUFFICIENT OVERLAPPING DATA</div>
            )}
          </Panel>
        </div>

        <div className={styles.col}>
          <Panel badge="BRENT · 5Y SMALL MULTIPLES" title="SEASONALITY">
            {seasonality.length === 0 ? (
              <div className={styles.empty}>INSUFFICIENT HISTORY</div>
            ) : (
              <div className={styles.seasonalityGrid}>
                {seasonality.map((band) => (
                  <div className={styles.seasonalityTile} key={band.year}>
                    <div className={styles.seasonalityHeader}>
                      <span>{band.year}</span>
                      <span className={styles.seasonalityRange}>
                        {band.min.toFixed(0)} – {band.max.toFixed(0)}
                      </span>
                    </div>
                    <Sparkline
                      ariaLabel={`Brent ${band.year}`}
                      color="#ff8c00"
                      fill
                      height={30}
                      series={band.values}
                      width={160}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel badge="AWAITING FEED" title="FREIGHT · TANKERS">
            <div className={styles.placeholder}>
              Baltic TD3C / TD22 / TD20 / TD25 feeds require a BalticExchange
              subscription or AISStream-derived voyage proxies. Not wired
              yet — no fabricated rates.
            </div>
          </Panel>
          <Panel badge="AWAITING FEED" title="REFINERY MARGINS">
            <div className={styles.placeholder}>
              Singapore 3-2-1, NWE Gasoil, RBOB crack — computed from EIA
              product prices. Wired in a follow-up once the product-price
              service lands.
            </div>
          </Panel>
          <Panel badge="AWAITING FEED" title="FX · REGIONAL">
            <div className={styles.placeholder}>
              Pegged pairs (USD/SAR, USD/AED, USD/QAR) are technically
              constant; free-market USD/IRR and USD/EGP feeds not yet
              wired. Placeholder stands until a supported provider is
              integrated.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
}

/**
 * Compute Pearson correlation of log-returns across the available
 * crude series, aligned on shared dates. When <2 symbols share
 * enough overlap we return null and the UI shows an empty state —
 * rather than surface a misleading 1×1 matrix.
 */
function computeCorrelations(
  brent: CrudePriceSnapshot | null,
  dme: DmeOmanSnapshot | null,
  murban: MurbanSnapshot | null
): CorrelationMatrix | null {
  const series: { symbol: string; points: PricePoint[] }[] = [];
  if (brent?.series.brent?.length) {
    series.push({ symbol: "BRENT", points: brent.series.brent });
  }
  if (brent?.series.wti?.length) {
    series.push({ symbol: "WTI", points: brent.series.wti });
  }
  if (dme?.series.dmeOman?.length) {
    series.push({ symbol: "DUBAI", points: dme.series.dmeOman });
  }
  if (murban?.series.murban?.length) {
    series.push({ symbol: "MURBAN", points: murban.series.murban });
  }

  if (series.length < 2) return null;

  // Align on the intersection of dates so the matrix is square even
  // when feeds have different start dates.
  const allDates = series.map((s) => new Set(s.points.map((p) => p.date)));
  const sharedDates = [...allDates[0]].filter((d) =>
    allDates.every((set) => set.has(d))
  );
  if (sharedDates.length < 10) return null;

  // Build aligned log-returns per symbol.
  const returns = series.map((s) => {
    const bySharedDate = new Map(s.points.map((p) => [p.date, p.value]));
    const aligned = sharedDates
      .slice()
      .sort()
      .map((d) => bySharedDate.get(d) ?? 0);
    const rets: number[] = [];
    for (let i = 1; i < aligned.length; i++) {
      const prev = aligned[i - 1];
      const cur = aligned[i];
      if (prev <= 0 || cur <= 0) {
        rets.push(0);
      } else {
        rets.push(Math.log(cur / prev));
      }
    }
    return rets;
  });

  const symbols = series.map((s) => s.symbol);
  const matrix: number[][] = symbols.map((_, i) =>
    symbols.map((_, j) => pearson(returns[i], returns[j]))
  );

  return { symbols, matrix };
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let numer = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numer += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? numer / denom : 0;
}

function correlationTint(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped >= 0) {
    const alpha = clamped * 0.45;
    return `rgba(0, 200, 83, ${alpha.toFixed(2)})`;
  }
  const alpha = Math.abs(clamped) * 0.45;
  return `rgba(255, 23, 68, ${alpha.toFixed(2)})`;
}

interface SeasonalityBand {
  year: string;
  values: number[];
  min: number;
  max: number;
}

function computeSeasonalityBands(series: PricePoint[]): SeasonalityBand[] {
  if (!series || series.length === 0) return [];
  const byYear = new Map<string, number[]>();
  for (const point of series) {
    const year = point.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(point.value);
  }
  return Array.from(byYear.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-5)
    .map(([year, values]) => ({
      year,
      values,
      min: Math.min(...values),
      max: Math.max(...values)
    }));
}
