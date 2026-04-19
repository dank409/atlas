/**
 * AIS (Automatic Identification System) position report, normalised
 * from AISStream.io's PositionReport message. The raw feed is firehose;
 * we store only the fields the Atlas UI renders.
 */
export interface AisPosition {
  /** Stable identifier: `${mmsi}` for live; prefixed in tests. */
  id: string;
  mmsi: number;
  /** Vessel name — may be blank in the raw feed for some ships. */
  vesselName: string;
  /** IMO number, 0 when unknown. */
  imo: number;
  /** Speed over ground, knots. */
  sog: number;
  /** Course over ground, degrees. */
  cog: number;
  /** Latest position in decimal degrees. */
  lat: number;
  lon: number;
  /** Current nav status code (0-15, AIS spec). */
  navStatus?: number;
  /** Maximum static draft in metres — static report field. */
  draftMeters?: number;
  /** ISO 8601 timestamp of the report. */
  receivedAt: string;
  /** Rough classification derived from AIS ShipType + name heuristics. */
  vesselClass?: "VLCC" | "SUEZMAX" | "AFRAMAX" | "LNG" | "LPG" | "OTHER";
}

export interface AisConnectionState {
  status: "IDLE" | "CONNECTING" | "OPEN" | "CLOSED" | "ERROR";
  lastError?: string;
  /** Wall-clock timestamp the socket entered OPEN state. */
  openedAt?: string;
}

export interface AisSessionStats {
  tankersTracked24h: number;
  uniqueMmsiSeen: number;
  messagesReceived: number;
  msgRatePerMin: number;
}
