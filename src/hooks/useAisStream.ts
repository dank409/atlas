import { useEffect, useRef, useState } from "react";
import { connectAisStream } from "../services/aisStream";
import type {
  AisConnectionState,
  AisPosition,
  AisSessionStats
} from "../types/Ais";

// Hard cap on the number of vessel IDs the table keeps in memory.
// AISStream can firehose thousands per minute in a MENA box, so we
// keep only the most recent N per MMSI and prune aggressively.
const MAX_TRACKED = 800;

// Throttle state updates — the feed ticks multiple times per second,
// which would cause React to re-render at the same rate without batching.
const BATCH_INTERVAL_MS = 600;

export interface UseAisStreamResult {
  /** Most-recent position per MMSI. */
  positions: AisPosition[];
  connection: AisConnectionState;
  stats: AisSessionStats;
  /** True when no API key is configured (hook is inert). */
  disabled: boolean;
}

/**
 * React adapter around `connectAisStream`. Opens a single WebSocket
 * for the component lifetime, batches incoming positions into state
 * at ~1.6 Hz so rendering stays cheap, and exposes session statistics
 * (messages received, vessels seen, rolling rate per minute).
 *
 * When `VITE_AISSTREAM_API_KEY` is missing the hook stays idle —
 * the AisPage will render an honest "not wired" state instead.
 */
export function useAisStream(): UseAisStreamResult {
  const apiKey = import.meta.env.VITE_AISSTREAM_API_KEY;
  const [positions, setPositions] = useState<AisPosition[]>([]);
  const [connection, setConnection] = useState<AisConnectionState>({ status: "IDLE" });
  const [stats, setStats] = useState<AisSessionStats>({
    tankersTracked24h: 0,
    uniqueMmsiSeen: 0,
    messagesReceived: 0,
    msgRatePerMin: 0
  });
  const bufferRef = useRef<Map<string, AisPosition>>(new Map());
  const messageCountRef = useRef(0);
  const ratesWindowRef = useRef<number[]>([]);

  useEffect(() => {
    if (!apiKey) return;

    setConnection({ status: "CONNECTING" });
    const handle = connectAisStream({
      apiKey,
      onPosition: (position) => {
        bufferRef.current.set(position.id, position);
        messageCountRef.current += 1;
      },
      onStateChange: (status, detail) => {
        setConnection((current) => ({
          status,
          // Clear the error line whenever we're connected again — a
          // transient error at startup shouldn't stay lit forever.
          lastError:
            status === "ERROR"
              ? detail
              : status === "OPEN"
                ? undefined
                : current.lastError,
          openedAt: status === "OPEN" ? new Date().toISOString() : current.openedAt
        }));
      }
    });

    const flushInterval = window.setInterval(() => {
      const buffer = bufferRef.current;
      if (buffer.size === 0) return;

      setPositions((current) => {
        const byId = new Map(current.map((p) => [p.id, p]));
        for (const [id, pos] of buffer.entries()) {
          byId.set(id, pos);
        }
        // Drop oldest when over cap.
        const list = Array.from(byId.values());
        list.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
        return list.slice(0, MAX_TRACKED);
      });

      setStats((current) => {
        const minuteWindow = ratesWindowRef.current;
        const now = Date.now();
        minuteWindow.push(now);
        while (minuteWindow.length > 0 && now - minuteWindow[0] > 60_000) {
          minuteWindow.shift();
        }
        const msgRatePerMin =
          minuteWindow.length > 1 ? messageCountRef.current / Math.max(1, Math.round((now - minuteWindow[0]) / 60_000)) : 0;
        return {
          tankersTracked24h: Math.max(current.tankersTracked24h, bufferRef.current.size + current.uniqueMmsiSeen),
          uniqueMmsiSeen: Math.max(current.uniqueMmsiSeen, bufferRef.current.size),
          messagesReceived: messageCountRef.current,
          msgRatePerMin
        };
      });

      buffer.clear();
    }, BATCH_INTERVAL_MS);

    return () => {
      handle.stop();
      window.clearInterval(flushInterval);
    };
  }, [apiKey]);

  return {
    positions,
    connection,
    stats,
    disabled: !apiKey
  };
}
