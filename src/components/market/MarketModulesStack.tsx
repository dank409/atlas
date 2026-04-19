import type { FirmsFacilityAnomaly } from "../../types/firms";
import type { OutageEvent } from "../../types/outageEvent";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary,
  CrudePriceSnapshot,
  DmeOmanSnapshot,
  MurbanSnapshot
} from "../../types/Market";
import type { IceBrentSettlementSnapshot } from "../../types/IceSettlements";
import { PriceGridModule } from "./PriceGridModule";
import { SpreadsModule } from "./SpreadsModule";
import { TermCurveModule } from "./TermCurveModule";
import { RiskFeedModule } from "./RiskFeedModule";

interface MarketModulesStackProps {
  summary: CrudeMarketSummary | null;
  brentWtiSnapshot: CrudePriceSnapshot | null;
  dmeOmanSnapshot: DmeOmanSnapshot | null;
  murbanSnapshot: MurbanSnapshot | null;
  iceSnapshot: IceBrentSettlementSnapshot | null;
  timespreads: BrentTimespreadSnapshot | null;
  outageEvents: OutageEvent[];
  firmsAnomalies: FirmsFacilityAnomaly[];
  mode: "LIVE" | "STATIC_SNAPSHOT";
}

/**
 * Right-rail market-data stack: price grid + spreads + forward curve
 * + risk feed. Each module is independently testable and pulls from
 * the data hooks the caller already uses for the market tape and
 * dashboard, so we don't duplicate the loading machinery.
 *
 * This is deliberately dumb: it takes pre-resolved snapshots and
 * passes them down. The hook-wiring lives in App.tsx where the
 * snapshots are already bound for the tape and dashboard surfaces.
 */
export function MarketModulesStack({
  summary,
  brentWtiSnapshot,
  dmeOmanSnapshot,
  murbanSnapshot,
  iceSnapshot,
  timespreads,
  outageEvents,
  firmsAnomalies,
  mode
}: MarketModulesStackProps) {
  return (
    <>
      <PriceGridModule
        brentWtiSnapshot={brentWtiSnapshot}
        dmeOmanSnapshot={dmeOmanSnapshot}
        mode={mode}
        murbanSnapshot={murbanSnapshot}
        summary={summary}
      />
      <SpreadsModule summary={summary} timespreads={timespreads} />
      <TermCurveModule snapshot={iceSnapshot} timespreads={timespreads} />
      <RiskFeedModule firmsAnomalies={firmsAnomalies} outageEvents={outageEvents} />
    </>
  );
}
