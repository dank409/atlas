import { useMemo, useState } from "react";
import { Panel } from "../common/Panel";
import { BrentHistoricalChart } from "../charts/BrentHistoricalChart";
import { FuturesCurveChart } from "../charts/FuturesCurveChart";
import { InventoryChart } from "../charts/InventoryChart";
import { FirmsAlertFeed } from "../panels/FirmsAlertFeed";
import { FirmsControlPanel } from "../panels/FirmsControlPanel";
import { DashboardTileOverlay } from "./DashboardTileOverlay";
import { runFuturesCurveScenario } from "../../utils/futuresCurveModel";
import type { IceBrentSettlementSnapshot } from "../../types/IceSettlements";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary,
  EiaWeeklyInventorySnapshot
} from "../../types/Market";
import type { BrentHistoricalSnapshot } from "../../services/brentHistorical";
import type { OutageEventSnapshot } from "../../types/outageEvent";
import type { FirmsSnapshot, FirmsWindowHours } from "../../types/firms";
import {
  formatCadenceLabel,
  formatClassificationLabel
} from "../../types/DataSource";
import type { BypassModelResult, BypassModelState } from "../../utils/bypassModel";
import { formatTransitVolume } from "../../utils/formatters";
import {
  formatChange,
  formatChangePct,
  formatPrice,
  formatSpread
} from "../../utils/marketSummary";
import styles from "./DashboardView.module.css";

/**
 * Situation room layout — rebuilt around the CLAUDE.md Connecting
 * Thread:
 *
 *   "Given a disruption at chokepoint or asset X, what breaks in
 *    the physical supply chain, for how long, which refineries lose
 *    feedstock, and does the forward curve already know?"
 *
 * Every tile either moves when the user drags the Hormuz slider or
 * supplies an input the modeler consumes. Tiles that failed the
 * stress test were removed (WORKSPACE SNAPSHOT, CURRENT SELECTION,
 * PRIORITY ASSETS, NEWS WIRE, ACTIVITY LOG → status-bar ticker).
 *
 * Each tile has a compact render (used in the grid) and an expanded
 * render (used in the click-to-expand overlay). Compact hides
 * legends, narratives, window-selector controls, source lines, and
 * other chrome so charts get maximum vertical space in the small
 * grid cell. Expanded shows the full detail at overlay size.
 */

type DashboardTileId =
  | "bypass"
  | "curve"
  | "hist"
  | "alert"
  | "choke"
  | "market"
  | "inventory"
  | "firms";

interface DashboardViewProps {
  brentHistorical: BrentHistoricalSnapshot | null;
  bypassResult: BypassModelResult;
  firmsSnapshot: FirmsSnapshot | null;
  firmsIsLoading: boolean;
  firmsError: Error | null;
  inventorySnapshot: EiaWeeklyInventorySnapshot | null;
  inventoryIsLoading: boolean;
  inventoryError: Error | null;
  firmsWindowHours: FirmsWindowHours;
  firmsConfidenceThreshold: number;
  isFirmsLayerEnabled: boolean;
  onFirmsWindowChange: (window: FirmsWindowHours) => void;
  onFirmsConfidenceChange: (value: number) => void;
  onFirmsLayerToggle: () => void;
  iceSettlements: IceBrentSettlementSnapshot | null;
  isScenarioActive: boolean;
  lastUpdate: string;
  marketSummary: CrudeMarketSummary | null;
  outageEvents: OutageEventSnapshot | null;
  onInspectAsset?: (asset: InfrastructureAsset) => void;
  timespreads?: BrentTimespreadSnapshot | null;
  visibleAssets: InfrastructureAsset[];
}

export function DashboardView({
  brentHistorical,
  bypassResult,
  firmsSnapshot,
  firmsIsLoading,
  firmsError,
  inventorySnapshot,
  inventoryIsLoading,
  inventoryError,
  firmsWindowHours,
  firmsConfidenceThreshold,
  isFirmsLayerEnabled,
  onFirmsWindowChange,
  onFirmsConfidenceChange,
  onFirmsLayerToggle,
  iceSettlements,
  isScenarioActive,
  lastUpdate,
  marketSummary,
  outageEvents,
  onInspectAsset,
  timespreads = null,
  visibleAssets
}: DashboardViewProps) {
  const [expandedTileId, setExpandedTileId] = useState<DashboardTileId | null>(null);

  const chokepoints = visibleAssets
    .filter((asset): asset is Extract<InfrastructureAsset, { assetKind: "chokepoint" }> => asset.assetKind === "chokepoint")
    .sort((left, right) => right.transitVolume_mbpd - left.transitVolume_mbpd);
  const futuresCurveResult = useMemo(
    () => runFuturesCurveScenario(bypassResult),
    [bypassResult]
  );

  // ---------------------------------------------------------------
  // Tile body renderers — each takes `isCompact` and produces JSX.
  // The dashboard grid calls each with `true`; the tile-expand
  // overlay calls them with `false`. Compact mode hides chrome
  // (rationale, legend, controls, source lines) so the primary
  // readout or chart gets maximum room in the tiny grid cell.
  // ---------------------------------------------------------------

  const renderBypassBody = (isCompact: boolean) => (
    <div className={styles.scenarioBlock}>
      <div className={styles.scenarioRow}>
        <span className={styles.scenarioLabel}>STATE</span>
        <span
          className={styles.scenarioValue}
          data-tone={bypassStateTone(bypassResult.state, bypassResult.daysToOperationalMinimum)}
        >
          {bypassStateLabel(bypassResult.state)}
        </span>
      </div>
      <div className={styles.scenarioRow}>
        <span className={styles.scenarioLabel}>NET DEFICIT</span>
        <span
          className={styles.scenarioValue}
          data-tone={bypassResult.netDailyDeficitMbpd > 0 ? "red" : "green"}
        >
          {bypassResult.netDailyDeficitMbpd.toFixed(2)} MBPD
        </span>
      </div>
      <div className={styles.scenarioRow}>
        <span className={styles.scenarioLabel}>DAYS TO BREACH</span>
        <span
          className={styles.scenarioValue}
          data-tone={bypassDaysTone(bypassResult)}
        >
          {bypassResult.daysToOperationalMinimum !== null
            ? `${bypassResult.daysToOperationalMinimum.toFixed(1)} D`
            : bypassResult.ieaExhaustionDays !== null
              ? `IEA CAP ${bypassResult.ieaExhaustionDays.toFixed(0)} D`
              : "--"}
        </span>
      </div>
      {!isCompact ? (
        <>
          <div className={styles.scenarioRationale}>{bypassResult.rationale}</div>
          <div className={styles.sourceLine}>
            MODEL · HORMUZ {bypassResult.constants.hormuzCrudeFlowMbpd.toFixed(1)} MBPD ·
            {" "}DISRUPTION {bypassResult.disruptionPct.toFixed(0)}%
          </div>
        </>
      ) : null}
    </div>
  );

  const renderCurveBody = (isCompact: boolean) => (
    <FuturesCurveChart
      result={futuresCurveResult}
      observedStrip={iceSettlements?.strip ?? null}
      observedCadence={iceSettlements?.cadence ?? null}
      observedClassification={iceSettlements?.classification ?? null}
      observedAsOf={iceSettlements?.asOf ?? null}
      isCompact={isCompact}
    />
  );

  const renderHistBody = (isCompact: boolean) =>
    brentHistorical ? (
      <BrentHistoricalChart
        series={brentHistorical.series.brent}
        events={outageEvents?.events ?? []}
        asOf={brentHistorical.asOf}
        source={brentHistorical.source}
        isCompact={isCompact}
      />
    ) : (
      <div className={styles.sourceLine}>LOADING BRENT HISTORICAL…</div>
    );

  const renderAlertBody = () => (
    <FirmsAlertFeed
      snapshot={firmsSnapshot}
      isLoading={firmsIsLoading}
      error={firmsError}
    />
  );

  const renderInventoryBody = (isCompact: boolean) =>
    inventorySnapshot ? (
      <InventoryChart
        isCompact={isCompact}
        snapshot={inventorySnapshot}
      />
    ) : inventoryIsLoading ? (
      <div className={styles.sourceLine}>LOADING WEEKLY INVENTORIES…</div>
    ) : inventoryError ? (
      <div className={styles.placeholder}>WEEKLY INVENTORIES UNAVAILABLE.</div>
    ) : (
      <div className={styles.placeholder}>NO WEEKLY INVENTORY DATA.</div>
    );

  const renderChokeBody = () => (
    <div className={styles.tableShell}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "56%" }} />
          <col style={{ width: "44%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>NAME</th>
            <th className={styles.numericHeader}>TRANSIT</th>
          </tr>
        </thead>
        <tbody>
          {chokepoints.map((asset) => {
            const isClickable = Boolean(onInspectAsset);
            return (
              <tr
                className={isClickable ? styles.clickableRow : undefined}
                key={asset.id}
                onClick={
                  isClickable
                    ? (event) => {
                        // Don't let a row click inside the expanded
                        // overlay bubble up to the backdrop and close
                        // the modal before the asset inspect overlay
                        // has a chance to open.
                        event.stopPropagation();
                        onInspectAsset?.(asset);
                      }
                    : undefined
                }
              >
                <td title={asset.name}>{asset.name}</td>
                <td className={styles.numericCell}>
                  {formatTransitVolume(asset.transitVolume_mbpd)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderMarketBody = (isCompact: boolean) =>
    marketSummary ? (
      <div className={styles.marketBlock}>
        <MarketRow
          label="BRENT"
          value={formatPrice(marketSummary.brent.value)}
          change={marketSummary.brent.change}
          changePct={marketSummary.brent.changePct}
        />
        <MarketRow
          label="WTI"
          value={formatPrice(marketSummary.wti.value)}
          change={marketSummary.wti.change}
          changePct={marketSummary.wti.changePct}
        />
        <div className={styles.marketSpreadRow}>
          <span className={styles.marketLabel}>BRENT-WTI</span>
          <span className={styles.marketValue}>
            {formatSpread(marketSummary.brentWtiSpread)}
          </span>
          <span className={styles.marketTag}>
            {marketSummary.brentWtiSpread >= 0 ? "BRENT PREMIUM" : "WTI PREMIUM"}
          </span>
        </div>
        {marketSummary.dmeOman ? (
          <MarketRow
            label="DME OMAN"
            value={formatPrice(marketSummary.dmeOman.value)}
            change={marketSummary.dmeOman.change}
            changePct={marketSummary.dmeOman.changePct}
          />
        ) : null}
        {marketSummary.murban ? (
          <MarketRow
            label="MURBAN"
            value={formatPrice(marketSummary.murban.value)}
            change={marketSummary.murban.change}
            changePct={marketSummary.murban.changePct}
          />
        ) : null}
        {marketSummary.brentDmeOmanSpread !== undefined ? (
          <div className={styles.marketSpreadRow}>
            <span className={styles.marketLabel}>BRENT-OMAN</span>
            <span className={styles.marketValue}>
              {formatSpread(marketSummary.brentDmeOmanSpread)}
            </span>
            <span className={styles.marketTag}>
              {marketSummary.brentDmeOmanSpread >= 0
                ? "OMAN DISCOUNT"
                : "OMAN PREMIUM"}
            </span>
          </div>
        ) : null}
        {timespreads ? (
          <div className={styles.marketSpreadRow}>
            <span className={styles.marketLabel}>BRENT M1-M2</span>
            <span className={styles.marketValue}>
              {formatSpread(timespreads.m1MinusM2)}
            </span>
            <span className={styles.marketTag}>{timespreads.structure}</span>
          </div>
        ) : null}
        {!isCompact ? (
          <>
            <div className={styles.sourceLine}>
              {formatClassificationLabel(marketSummary.classification)} |{" "}
              {formatCadenceLabel(marketSummary.cadence)} | SOURCE:{" "}
              {marketSummary.source} | AS OF {marketSummary.asOf}
            </div>
            {timespreads ? (
              <div className={styles.sourceLine}>
                {formatClassificationLabel(timespreads.classification)} |{" "}
                {formatCadenceLabel(timespreads.cadence)} | CURVE:{" "}
                {timespreads.source} | AS OF {timespreads.asOf}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    ) : (
      <div className={styles.placeholder}>MARKET DATA UNAVAILABLE.</div>
    );

  const renderFirmsBody = (isCompact: boolean) => {
    // Compact: a text-only summary of the current FIRMS state that
    // fits inside the grid cell without any sliders or buttons. The
    // click-to-expand overlay reveals the full FirmsControlPanel
    // with interactive window selector + confidence slider + layer
    // toggle. This is the one tile where compact and expanded are
    // substantially different renders — the others share structure
    // and just gate chrome.
    if (isCompact) {
      const windowLabel =
        firmsWindowHours === 24 ? "24H" : firmsWindowHours === 72 ? "72H" : "7D";
      const detectCount = firmsSnapshot?.detections.length ?? 0;
      const matchCount = firmsSnapshot?.matches.length ?? 0;
      return (
        <div className={styles.firmsCompact}>
          <div className={styles.firmsCompactRow}>
            <span className={styles.firmsCompactLabel}>CADENCE</span>
            <span
              className={styles.firmsCompactValue}
              data-tone={firmsSnapshot?.classification === "OBSERVED" ? "green" : "amber"}
            >
              {firmsSnapshot ? formatCadenceLabel(firmsSnapshot.cadence) : "CURATED"}
            </span>
          </div>
          <div className={styles.firmsCompactRow}>
            <span className={styles.firmsCompactLabel}>WINDOW</span>
            <span className={styles.firmsCompactValue}>{windowLabel}</span>
          </div>
          <div className={styles.firmsCompactRow}>
            <span className={styles.firmsCompactLabel}>CONF ≥</span>
            <span className={styles.firmsCompactValue}>{firmsConfidenceThreshold}</span>
          </div>
          <div className={styles.firmsCompactRow}>
            <span className={styles.firmsCompactLabel}>LAYER</span>
            <span
              className={styles.firmsCompactValue}
              data-tone={isFirmsLayerEnabled ? "green" : "muted"}
            >
              {isFirmsLayerEnabled ? "VISIBLE" : "HIDDEN"}
            </span>
          </div>
          <div className={styles.firmsCompactRow}>
            <span className={styles.firmsCompactLabel}>SIGNAL</span>
            <span className={styles.firmsCompactValue}>
              {detectCount} DETECT · {matchCount} MATCH
            </span>
          </div>
        </div>
      );
    }
    return (
      <FirmsControlPanel
        snapshot={firmsSnapshot}
        windowHours={firmsWindowHours}
        confidenceThreshold={firmsConfidenceThreshold}
        isEnabled={isFirmsLayerEnabled}
        onChangeWindow={onFirmsWindowChange}
        onChangeConfidence={onFirmsConfidenceChange}
        onToggleEnabled={onFirmsLayerToggle}
      />
    );
  };

  // ---------------------------------------------------------------
  // Tile descriptor + overlay helpers
  // ---------------------------------------------------------------

  const bypassBadge = isScenarioActive ? "MODELED ACTIVE" : "SCENARIO LAB";
  const curveBadge = futuresCurveRegimeBadge(futuresCurveResult.regime);
  const histBadge = outageEvents
    ? `${outageEvents.events.length} EVENTS`
    : brentHistorical
      ? formatCadenceLabel(brentHistorical.cadence)
      : "LOADING";
  const alertBadge = firmsAlertBadge(firmsSnapshot);
  const chokeBadge = `${chokepoints.length} ACTIVE`;
  const marketBadge = marketSummary
    ? formatCadenceLabel(marketSummary.cadence)
    : "--";
  const inventoryBadge = inventorySnapshot
    ? formatCadenceLabel(inventorySnapshot.cadence)
    : inventoryIsLoading
      ? "LOADING"
      : "NO DATA";
  const firmsBadge = firmsSnapshot
    ? formatCadenceLabel(firmsSnapshot.cadence)
    : "--";

  // Pick the active tile's full-size content for the overlay. Kept
  // as a switch so adding a tile fails loudly on the exhaustive
  // check rather than silently rendering an empty modal.
  const expandedTile =
    expandedTileId !== null
      ? (() => {
          switch (expandedTileId) {
            case "bypass":
              return {
                title: "SCENARIO LAB",
                kindLabel: "MODELED PATH",
                badge: bypassBadge,
                body: renderBypassBody(false)
              };
            case "curve":
              return {
                title: "FORWARD CURVE",
                kindLabel: "SCENARIO OUTPUT",
                badge: curveBadge,
                body: renderCurveBody(false)
              };
            case "hist":
              return {
                title: "BRENT HISTORICAL",
                kindLabel: "TEMPORAL CONTEXT",
                badge: histBadge,
                body: renderHistBody(false)
              };
            case "alert":
              return {
                title: "FIRMS ALERT FEED",
                kindLabel: "ANOMALY SIGNAL",
                badge: alertBadge,
                body: renderAlertBody()
              };
            case "choke":
              return {
                title: "CHOKEPOINT WATCH",
                kindLabel: "MODELER INPUT",
                badge: chokeBadge,
                body: renderChokeBody()
              };
            case "market":
              return {
                title: "MARKET BRIEF",
                kindLabel: "BENCHMARKS",
                badge: marketBadge,
                body: renderMarketBody(false)
              };
            case "inventory":
              return {
                title: "US INVENTORIES",
                kindLabel: "WEEKLY BALANCE",
                badge: inventoryBadge,
                body: renderInventoryBody(false)
              };
            case "firms":
              return {
                title: "FIRMS CONTROLS",
                kindLabel: "PIPELINE TUNING",
                badge: firmsBadge,
                body: renderFirmsBody(false)
              };
          }
        })()
      : null;

  return (
    <section className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.title}>SITUATION ROOM</div>
        <div className={styles.meta}>UPDATED: {lastUpdate}</div>
      </header>
      <div className={styles.grid}>
        {/* Row 1 — slider outputs. */}
        <Panel
          className={styles.slotBypass}
          badge={bypassBadge}
          title="SCENARIO LAB"
          onExpand={() => setExpandedTileId("bypass")}
        >
          {renderBypassBody(true)}
        </Panel>
        <Panel
          className={styles.slotCurve}
          badge={curveBadge}
          title="FORWARD CURVE"
          onExpand={() => setExpandedTileId("curve")}
        >
          {renderCurveBody(true)}
        </Panel>

        {/* Row 2 — temporal context. */}
        <Panel
          className={styles.slotHist}
          badge={histBadge}
          title="BRENT HISTORICAL"
          onExpand={() => setExpandedTileId("hist")}
        >
          {renderHistBody(true)}
        </Panel>
        <Panel
          className={styles.slotAlert}
          badge={alertBadge}
          title="FIRMS ALERT FEED"
          onExpand={() => setExpandedTileId("alert")}
        >
          {renderAlertBody()}
        </Panel>

        {/* Row 3 — reference inputs. */}
        <Panel
          className={styles.slotChoke}
          badge={chokeBadge}
          title="CHOKEPOINT WATCH"
          onExpand={() => setExpandedTileId("choke")}
        >
          {renderChokeBody()}
        </Panel>
        <Panel
          className={styles.slotMarket}
          badge={marketBadge}
          title="MARKET BRIEF"
          onExpand={() => setExpandedTileId("market")}
        >
          {renderMarketBody(true)}
        </Panel>
        <Panel
          className={styles.slotInventory}
          badge={inventoryBadge}
          title="US INVENTORIES"
          onExpand={() => setExpandedTileId("inventory")}
        >
          {renderInventoryBody(true)}
        </Panel>
        <Panel
          className={styles.slotFirms}
          badge={firmsBadge}
          title="FIRMS CONTROLS"
          onExpand={() => setExpandedTileId("firms")}
        >
          {renderFirmsBody(true)}
        </Panel>
      </div>

      {expandedTile ? (
        <DashboardTileOverlay
          title={expandedTile.title}
          kindLabel={expandedTile.kindLabel}
          badge={expandedTile.badge}
          onClose={() => setExpandedTileId(null)}
        >
          {expandedTile.body}
        </DashboardTileOverlay>
      ) : null}
    </section>
  );
}

function MarketRow({
  label,
  value,
  change,
  changePct
}: {
  label: string;
  value: string;
  change: number;
  changePct: number;
}) {
  return (
    <div className={styles.marketRow}>
      <span className={styles.marketLabel}>{label}</span>
      <span className={styles.marketValue}>{value}</span>
      <span
        className={styles.marketChange}
        data-direction={directionOfChange(change)}
      >
        {formatChange(change)} ({formatChangePct(changePct)})
      </span>
    </div>
  );
}

function directionOfChange(change: number): "up" | "down" | "flat" {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

function firmsAlertBadge(snapshot: FirmsSnapshot | null): string {
  if (!snapshot) {
    return "--";
  }
  const alertCount = snapshot.anomalies.filter((a) => a.severity === "ALERT").length;
  const elevatedCount = snapshot.anomalies.filter((a) => a.severity === "ELEVATED").length;
  if (alertCount > 0) {
    return `${alertCount} ALERT`;
  }
  if (elevatedCount > 0) {
    return `${elevatedCount} ELEVATED`;
  }
  return "QUIET";
}

function futuresCurveRegimeBadge(
  regime: ReturnType<typeof runFuturesCurveScenario>["regime"]
): string {
  switch (regime) {
    case "EQUILIBRIUM":
      return "EQUILIBRIUM";
    case "MILD_BACKWARDATION":
      return "MILD BACKW";
    case "MODERATE_BACKWARDATION":
      return "MOD BACKW";
    case "SEVERE_BACKWARDATION":
      return "SEVERE BACKW";
  }
}

function bypassStateLabel(state: BypassModelState): string {
  return state;
}

function bypassStateTone(
  state: BypassModelState,
  daysToBreach: number | null
): "green" | "amber" | "red" {
  if (state === "EQUILIBRIUM" || state === "REPLENISHING") {
    return "green";
  }
  if (daysToBreach !== null && daysToBreach < 30) {
    return "red";
  }
  return "amber";
}

function bypassDaysTone(result: BypassModelResult): "muted" | "amber" | "red" {
  if (result.daysToOperationalMinimum !== null) {
    return result.daysToOperationalMinimum < 30 ? "red" : "amber";
  }
  if (result.ieaExhaustionDays !== null) {
    return "amber";
  }
  return "muted";
}
