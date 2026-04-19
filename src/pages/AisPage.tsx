import { useMemo } from "react";
import { Panel } from "../components/common/Panel";
import { useAisStream } from "../hooks/useAisStream";
import { PagePlaceholder } from "./PagePlaceholder";
import styles from "./AisPage.module.css";

/**
 * AIS WATCH view. When `VITE_AISSTREAM_API_KEY` is present the page
 * opens a live WebSocket to AISStream.io and renders:
 *
 *   - a live-positions table (MMSI / name / class / SOG / COG / lat-lon / age)
 *   - a session stats panel (tankers tracked, unique MMSIs, msg rate)
 *   - an AIS gaps placeholder (gap detector is a follow-up)
 *
 * When the key is missing the page falls back to the honest
 * "awaiting feed" placeholder — no fabricated vessel data.
 */
export function AisPage() {
  const { positions, connection, stats, disabled } = useAisStream();

  if (disabled) {
    return (
      <PagePlaceholder
        phase="VIEW · AIS"
        title="AIS WATCH"
        statusLine="LIVE · AISSTREAM.IO — API KEY MISSING"
        summary="Set VITE_AISSTREAM_API_KEY in your environment to open the live AIS WebSocket. The free tier limits messages per minute; the hook subscribes to a MENA bounding box to stay inside those limits."
        dependencies={[
          "VITE_AISSTREAM_API_KEY in .env.local",
          "Same var provisioned in Vercel for production"
        ]}
      />
    );
  }

  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [positions]
  );

  return (
    <div className={styles.page}>
      <section className={styles.main}>
        <Panel
          badge={connectionBadge(connection.status)}
          title="AIS WATCH · LIVE POSITIONS"
        >
          {sortedPositions.length === 0 ? (
            <div className={styles.empty}>
              {connection.status === "OPEN"
                ? "LISTENING — NO POSITIONS YET"
                : "CONNECTING TO AISSTREAM.IO…"}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>VESSEL</th>
                    <th>MMSI</th>
                    <th>IMO</th>
                    <th className={styles.numericCol}>SOG</th>
                    <th className={styles.numericCol}>COG</th>
                    <th>POSITION</th>
                    <th>LAST</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.slice(0, 120).map((pos) => (
                    <tr key={pos.id}>
                      <td className={styles.vesselCell}>
                        {pos.vesselName || "—"}
                      </td>
                      <td>{pos.mmsi}</td>
                      <td>{pos.imo ? pos.imo : "—"}</td>
                      <td className={styles.numericCol}>{pos.sog.toFixed(1)}</td>
                      <td className={styles.numericCol}>
                        {Math.round(pos.cog).toString().padStart(3, "0")}°
                      </td>
                      <td>
                        {pos.lat.toFixed(3)}°, {pos.lon.toFixed(3)}°
                      </td>
                      <td>{formatAge(pos.receivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel badge="AWAITING FEED" title="AIS GAPS · STS CANDIDATES">
          <div className={styles.placeholder}>
            AIS-gap detection (vessels silent ≥12h) and ship-to-ship
            transfer candidate inference require rolling state across
            sessions — planned as a follow-up once the storage layer
            lands. The live positions table above is the source of
            truth in the meantime.
          </div>
        </Panel>
      </section>

      <aside className={styles.sidebar}>
        <Panel badge="24H · THIS SESSION" title="SESSION STATS">
          <StatRow label="Tankers tracked" value={stats.tankersTracked24h} />
          <StatRow label="Unique MMSIs seen" value={stats.uniqueMmsiSeen} />
          <StatRow label="Messages received" value={stats.messagesReceived} />
          <StatRow label="Msg/min (rolling)" value={stats.msgRatePerMin.toFixed(1)} />
          <StatRow
            label="Connection"
            value={connection.status}
            tone={connection.status === "OPEN" ? "pos" : "warn"}
          />
          {connection.lastError ? (
            <div className={styles.err}>{connection.lastError}</div>
          ) : null}
        </Panel>

        <Panel title="METHOD · LIMITATIONS">
          <p className={styles.method}>
            Positions stream from AISStream.io, a free terrestrial + satellite
            AIS feed. Coverage is dense near coasts, patchier in open ocean.
            We treat AIS gaps as signal, not ground truth — a vessel dark
            for 12h in the Gulf of Aden could be in an anchorage, a
            reception shadow, or a deliberate disablement.
          </p>
          <p className={styles.method}>
            VLCC / Suezmax / Aframax classes cannot be resolved from the
            static AIS ShipType code alone — that's a DWT classification.
            This first pass buckets all tankers into <code>OTHER</code>;
            a future enrichment could join against a DWT reference table.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

function StatRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone?: "pos" | "warn";
}) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={tone === "pos" ? styles.statValuePos : tone === "warn" ? styles.statValueWarn : styles.statValue}>
        {value}
      </span>
    </div>
  );
}

function connectionBadge(status: string): string {
  if (status === "OPEN") return "LIVE";
  if (status === "CONNECTING") return "CONNECTING";
  if (status === "ERROR") return "ERROR";
  return status;
}

function formatAge(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}
