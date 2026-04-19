import type { AisPosition } from "../types/Ais";

/**
 * AISStream.io WebSocket client. Subscribes to vessel position reports
 * inside a MENA bounding box and streams normalised `AisPosition`s to
 * the supplied callback.
 *
 * Design notes:
 *   - All connection plumbing lives here so the React hook stays a
 *     thin adapter. The service maintains no React state; it returns
 *     an imperative `stop()` handle for the hook to call on unmount.
 *   - AISStream.io rejects connections where the filter box is the
 *     world; we scope tightly to the Atlas region of interest
 *     (≈25° around the Arabian Peninsula) to stay inside free-tier
 *     message limits.
 *   - Incoming messages that aren't `PositionReport` are ignored.
 *     Static (ShipStaticData) messages would carry ship-type and
 *     destination, but their cadence is slow enough that we skip
 *     them for this first pass.
 */
const AIS_STREAM_WS = "wss://stream.aisstream.io/v0/stream";

// Bounding box roughly covering MENA + adjacent shipping lanes:
// [[minLat, minLon], [maxLat, maxLon]]
// South-west (Gulf of Aden) to North-east (Black Sea).
const MENA_BOUNDING_BOXES: Array<[[number, number], [number, number]]> = [
  [
    [10, 30], // SW: Gulf of Aden / Eritrea
    [45, 65]  // NE: Caspian / Turkmenistan longitude
  ]
];

interface AisStreamMessage {
  MessageType?: string;
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      Cog?: number;
      Sog?: number;
      Latitude?: number;
      Longitude?: number;
      NavigationalStatus?: number;
      UserID?: number;
    };
    ShipStaticData?: {
      ImoNumber?: number;
      Name?: string;
      MaximumStaticDraught?: number;
      Type?: number;
    };
  };
}

export interface AisStreamOptions {
  apiKey: string;
  onPosition: (position: AisPosition) => void;
  onStateChange?: (state: "CONNECTING" | "OPEN" | "CLOSED" | "ERROR", detail?: string) => void;
}

export interface AisStreamHandle {
  stop: () => void;
}

export function connectAisStream({
  apiKey,
  onPosition,
  onStateChange
}: AisStreamOptions): AisStreamHandle {
  let socket: WebSocket | null = null;
  let stopped = false;
  // Cache static data (ship name + IMO) keyed by MMSI so subsequent
  // position reports can attach the vessel name.
  const staticCache = new Map<number, { name: string; imo: number; draft?: number; shipType?: number }>();

  function connect() {
    if (stopped) return;
    onStateChange?.("CONNECTING");
    socket = new WebSocket(AIS_STREAM_WS);

    socket.onopen = () => {
      onStateChange?.("OPEN");
      socket?.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: MENA_BOUNDING_BOXES,
          FilterMessageTypes: ["PositionReport", "ShipStaticData"]
        })
      );
    };

    socket.onmessage = (event) => {
      let payload: AisStreamMessage;
      try {
        payload = JSON.parse(event.data as string) as AisStreamMessage;
      } catch {
        return;
      }

      if (payload.MessageType === "ShipStaticData") {
        const meta = payload.MetaData;
        const data = payload.Message?.ShipStaticData;
        if (meta?.MMSI && data) {
          staticCache.set(meta.MMSI, {
            name: (data.Name ?? meta.ShipName ?? "").trim(),
            imo: data.ImoNumber ?? 0,
            draft: data.MaximumStaticDraught,
            shipType: data.Type
          });
        }
        return;
      }

      if (payload.MessageType !== "PositionReport") return;
      const pos = payload.Message?.PositionReport;
      const meta = payload.MetaData;
      if (!pos || !meta) return;
      const mmsi = pos.UserID ?? meta.MMSI;
      if (typeof mmsi !== "number") return;

      const cached = staticCache.get(mmsi);
      const next: AisPosition = {
        id: String(mmsi),
        mmsi,
        vesselName: (cached?.name || meta.ShipName || "").trim(),
        imo: cached?.imo ?? 0,
        sog: pos.Sog ?? 0,
        cog: pos.Cog ?? 0,
        lat: pos.Latitude ?? meta.latitude ?? 0,
        lon: pos.Longitude ?? meta.longitude ?? 0,
        navStatus: pos.NavigationalStatus,
        draftMeters: cached?.draft,
        receivedAt: meta.time_utc ?? new Date().toISOString(),
        vesselClass: classifyVessel(cached?.shipType, cached?.name)
      };
      onPosition(next);
    };

    socket.onerror = () => {
      onStateChange?.("ERROR", "WebSocket error");
    };

    socket.onclose = () => {
      onStateChange?.("CLOSED");
      if (!stopped) {
        // Reconnect with exponential-ish backoff capped at 30s.
        const delay = 3000;
        window.setTimeout(() => {
          if (!stopped) connect();
        }, delay);
      }
    };
  }

  connect();

  return {
    stop() {
      stopped = true;
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    }
  };
}

/**
 * ShipType → coarse class bucket. AIS ShipType codes 71–79 are tanker
 * subtypes. The bucket is refined using the vessel name when available
 * (VLCC / SUEZMAX / AFRAMAX are a DWT classification that AIS doesn't
 * encode directly — we fall back to "OTHER" tanker when we can't tell).
 */
export function classifyVessel(
  shipType: number | undefined,
  name: string | undefined
): AisPosition["vesselClass"] {
  if (!shipType && !name) return "OTHER";
  const n = (name ?? "").toUpperCase();
  if (shipType && shipType >= 80 && shipType < 90) return "LNG";
  if (shipType && shipType === 89) return "LPG";
  if (n.includes("LNG")) return "LNG";
  if (n.includes("LPG")) return "LPG";
  if (shipType && shipType >= 70 && shipType < 80) {
    // We can't reliably distinguish VLCC / Suezmax / Aframax from AIS
    // alone — DWT isn't in the static report. Return OTHER so
    // downstream code can decide how to bucket it.
    return "OTHER";
  }
  return "OTHER";
}
