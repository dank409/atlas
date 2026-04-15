import type { CrudeMarketSummary } from "../../types/Market";
import { formatChange, formatChangePct, formatPrice, formatSpread } from "../../utils/marketSummary";
import styles from "./MarketTape.module.css";

interface MarketTapeProps {
  error: Error | null;
  isLoading: boolean;
  summary: CrudeMarketSummary | null;
}

export function MarketTape({ error, isLoading, summary }: MarketTapeProps) {
  if (isLoading) {
    return (
      <div className={styles.tape}>
        <div className={styles.loadingLabel}>LOADING MARKET DATA…</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={styles.tape}>
        <div className={styles.offlineLabel}>MARKET FEED OFFLINE</div>
      </div>
    );
  }

  // `summary.mode` is now derived from the DME Oman snapshot mode (see
  // marketSummary.ts). That keeps the tape badged STATIC whenever the
  // primary Gulf benchmark is coming from the checked-in snapshot,
  // even if EIA Brent is streaming LIVE on the same tape.
  const modeLabel = summary.mode === "LIVE" ? "LIVE" : "STATIC";
  const brentDirection = directionOf(summary.brent.change);
  const dmeOmanDirection = summary.dmeOman
    ? directionOf(summary.dmeOman.change)
    : "flat";
  const murbanDirection = summary.murban
    ? directionOf(summary.murban.change)
    : "flat";
  // Brent - Oman is the east-of-Suez arb. Positive = Oman discount;
  // direction arrow follows the sign so traders get the visual cue.
  const brentOmanSpread = summary.brentDmeOmanSpread;
  const spreadDirection = directionOf(brentOmanSpread ?? 0);

  return (
    <div
      aria-label="MARKET TAPE"
      className={styles.tape}
      role="region"
    >
      <div className={styles.sourceLabel}>GULF</div>
      <Tile
        changeLabel={`${formatChange(summary.brent.change)} (${formatChangePct(summary.brent.changePct)})`}
        direction={brentDirection}
        label="BRENT"
        value={formatPrice(summary.brent.value)}
      />
      {summary.dmeOman ? (
        <Tile
          changeLabel={`${formatChange(summary.dmeOman.change)} (${formatChangePct(summary.dmeOman.changePct)})`}
          direction={dmeOmanDirection}
          label="DME OMAN"
          value={formatPrice(summary.dmeOman.value)}
        />
      ) : (
        <Tile changeLabel="STATIC LOAD FAILED" direction="flat" label="DME OMAN" value="--" />
      )}
      {summary.murban ? (
        <Tile
          changeLabel={`${formatChange(summary.murban.change)} (${formatChangePct(summary.murban.changePct)})`}
          direction={murbanDirection}
          label="MURBAN"
          value={formatPrice(summary.murban.value)}
        />
      ) : (
        <Tile changeLabel="STATIC LOAD FAILED" direction="flat" label="MURBAN" value="--" />
      )}
      {brentOmanSpread !== undefined ? (
        <Tile
          changeLabel={brentOmanSpread >= 0 ? "OMAN DISCOUNT" : "OMAN PREMIUM"}
          direction={spreadDirection}
          label="BRENT-OMAN"
          value={formatSpread(brentOmanSpread)}
        />
      ) : null}
      <div className={styles.metaBlock}>
        <span className={styles.modeLabel} data-mode={modeLabel.toLowerCase()}>
          {modeLabel}
        </span>
        <span className={styles.metaSeparator}>|</span>
        <span className={styles.metaText}>AS OF {summary.asOf}</span>
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
