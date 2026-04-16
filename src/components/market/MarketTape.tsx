import {
  formatCadenceLabel,
  formatClassificationLabel
} from "../../types/DataSource";
import type {
  BrentTimespreadSnapshot,
  CrudeMarketSummary
} from "../../types/Market";
import {
  formatChange,
  formatChangePct,
  formatPrice,
  formatSpread
} from "../../utils/marketSummary";
import styles from "./MarketTape.module.css";

interface MarketTapeProps {
  error: Error | null;
  isLoading: boolean;
  summary: CrudeMarketSummary | null;
  timespreads?: BrentTimespreadSnapshot | null;
}

export function MarketTape({
  error,
  isLoading,
  summary,
  timespreads = null
}: MarketTapeProps) {
  if (isLoading) {
    return (
      <div className={styles.tape}>
        <div className={styles.loadingLabel}>LOADING MACRO CONTEXT…</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={styles.tape}>
        <div className={styles.offlineLabel}>MACRO DATA UNAVAILABLE</div>
      </div>
    );
  }

  return (
    <div
      aria-label="MARKET TAPE"
      className={styles.tape}
      role="region"
    >
      <div className={styles.sourceLabel}>MACRO</div>
      <Tile
        changeLabel={`${formatChange(summary.brent.change)} (${formatChangePct(summary.brent.changePct)})`}
        direction={directionOf(summary.brent.change)}
        label="BRENT"
        value={formatPrice(summary.brent.value)}
      />
      <Tile
        changeLabel={`${formatChange(summary.wti.change)} (${formatChangePct(summary.wti.changePct)})`}
        direction={directionOf(summary.wti.change)}
        label="WTI"
        value={formatPrice(summary.wti.value)}
      />
      <Tile
        changeLabel={
          summary.brentWtiSpread >= 0 ? "BRENT PREMIUM" : "WTI PREMIUM"
        }
        direction={directionOf(summary.brentWtiSpread)}
        label="BRENT-WTI"
        value={formatSpread(summary.brentWtiSpread)}
      />
      {summary.dmeOman ? (
        <Tile
          changeLabel={`${formatChange(summary.dmeOman.change)} (${formatChangePct(summary.dmeOman.changePct)})`}
          direction={directionOf(summary.dmeOman.change)}
          label="DME OMAN"
          value={formatPrice(summary.dmeOman.value)}
        />
      ) : (
        <Tile
          changeLabel="NO OPEN DATA"
          direction="flat"
          label="DME OMAN"
          value="--"
        />
      )}
      {timespreads ? (
        <Tile
          changeLabel={timespreads.structure}
          direction={directionOf(timespreads.m1MinusM2)}
          label="BRENT M1-M2"
          value={formatSpread(timespreads.m1MinusM2)}
        />
      ) : (
        <Tile
          changeLabel="NO OPEN DATA"
          direction="flat"
          label="BRENT M1-M2"
          value="--"
        />
      )}
      <div className={styles.metaBlock}>
        <span className={styles.metaText}>
          SPOT | {formatClassificationLabel(summary.classification)} |{" "}
          {formatCadenceLabel(summary.cadence)} | {summary.source} | {summary.asOf}
        </span>
        {timespreads ? (
          <span className={styles.metaText}>
            CURVE | {formatClassificationLabel(timespreads.classification)} |{" "}
            {formatCadenceLabel(timespreads.cadence)} | {timespreads.source} |{" "}
            {timespreads.asOf}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function directionOf(value: number): "up" | "down" | "flat" {
  if (value > 0) {
    return "up";
  }

  if (value < 0) {
    return "down";
  }

  return "flat";
}

interface TileProps {
  changeLabel: string;
  direction: "up" | "down" | "flat";
  label: string;
  value: string;
}

function Tile({ changeLabel, direction, label, value }: TileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileChange} data-direction={direction}>
        {direction === "up" ? "▲" : direction === "down" ? "▼" : "·"} {changeLabel}
      </span>
    </div>
  );
}
