import type { DataSourceMetadata } from "./DataSource";

/**
 * ICE Futures Europe Brent forward strip — M1 through M12 end-of-day
 * settlement prices. Unlike the spot-price series consumed from EIA, this
 * is a single daily snapshot of the forward curve rather than a time
 * series — each contract month is one observation on one settlement date.
 *
 * The strip is the counterparty to the model-implied curve from
 * `futuresCurveModel.ts`. Rendering both on the same axes lets the user
 * see where the paper market disagrees with the physical deficit model.
 */
export interface IceBrentStripPoint {
  /** 1-indexed contract month. M1 is the prompt (front) contract. */
  month: number;
  /** Vendor contract code (e.g., "BRN-M26"). Cosmetic; safe to ignore. */
  contractCode: string;
  /** Settlement price in USD/bbl. */
  priceUsd: number;
}

export interface IceBrentSettlementSnapshot extends DataSourceMetadata {
  /** Ordered M1..M12 strip, always length === 12. */
  strip: IceBrentStripPoint[];
}
