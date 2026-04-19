import { Panel } from "../components/common/Panel";
import styles from "./DataPage.module.css";

interface DataSourceRow {
  name: string;
  type: string;
  cadence: string;
  status: "LIVE" | "STATIC_SNAPSHOT" | "AWAITING_FEED";
  notes: string;
}

/**
 * DATA — a live manifest of every feed Atlas consumes, what cadence
 * it refreshes at, and whether we're currently serving the live wire
 * or a static fallback. This is the honest backside of the UI: the
 * page where you verify exactly what you're looking at before you
 * bet money on it.
 *
 * Keeping this list hardcoded is deliberate. Every new data source
 * must be added here manually — that friction forces the CLAUDE.md
 * Data Integrity Rule #6 ("live-or-static fallback is mandatory")
 * to remain explicit rather than drift as the service layer evolves.
 */
const DATA_SOURCES: DataSourceRow[] = [
  {
    name: "EIA Brent & WTI spot",
    type: "Prices · daily",
    cadence: "DAILY",
    status: "LIVE",
    notes: "VITE_EIA_API_KEY required. Falls back to /data/market/crude_prices_30d.json."
  },
  {
    name: "DME Oman basis",
    type: "Futures · EOD",
    cadence: "DAILY",
    status: "STATIC_SNAPSHOT",
    notes: "DME settlements are public but HTML-scraped. Static snapshot until the refresh script lands."
  },
  {
    name: "ADNOC Murban IFAD",
    type: "Futures · EOD",
    cadence: "DAILY",
    status: "STATIC_SNAPSHOT",
    notes: "IFAD settlements public — static snapshot matches the DME pattern."
  },
  {
    name: "ICE Brent forward strip M1–M12",
    type: "Futures · EOD",
    cadence: "DAILY",
    status: "STATIC_SNAPSHOT",
    notes: "Curated snapshot; moves to live when IBKR ICE subscription is provisioned."
  },
  {
    name: "NASA FIRMS VIIRS/MODIS",
    type: "Thermal anomaly · NRT",
    cadence: "6H (NRT)",
    status: "LIVE",
    notes: "VITE_FIRMS_MAP_KEY required. Falls back to /data/firms/recent_detections.json."
  },
  {
    name: "Global Energy Monitor / EDF OGIM",
    type: "Infrastructure · quarterly",
    cadence: "QUARTERLY",
    status: "STATIC_SNAPSHOT",
    notes: "Refineries, pipelines, fields, terminals. Curated supplement for named Gulf sites."
  },
  {
    name: "OECD inventory baselines",
    type: "Inventories · monthly",
    cadence: "MONTHLY",
    status: "STATIC_SNAPSHOT",
    notes: "IEA monthly report. Drives the days-to-operational-minimum output of the bypass model."
  },
  {
    name: "Outage event log",
    type: "Events · curated",
    cadence: "ON-EVENT",
    status: "STATIC_SNAPSHOT",
    notes: "Manually curated from news + operator disclosures. Feeds the EVENTS feed and scrubber markers."
  },
  {
    name: "EIA weekly inventories",
    type: "Inventories · weekly",
    cadence: "WEEKLY",
    status: "LIVE",
    notes: "US Commercial Crude, Cushing, SPR. 5y-average band included."
  },
  {
    name: "AISStream.io AIS feed",
    type: "Vessels · NRT",
    cadence: "LIVE · WS",
    status: "AWAITING_FEED",
    notes: "Free tier. Integration deferred. AIS view renders AWAITING FEED until wired."
  },
  {
    name: "EIA bilateral crude flows",
    type: "Trade · monthly",
    cadence: "MONTHLY",
    status: "AWAITING_FEED",
    notes: "Curated JSON ships with the FLOWS Sankey view — not yet cut."
  },
  {
    name: "Lloyd's JWC war-risk listings",
    type: "Insurance · ad-hoc",
    cadence: "AD-HOC",
    status: "AWAITING_FEED",
    notes: "Public listings; CHOKES view renders AWAITING FEED for the war-risk column until scraped."
  }
];

export function DataPage() {
  const summary = {
    live: DATA_SOURCES.filter((s) => s.status === "LIVE").length,
    staticSnapshot: DATA_SOURCES.filter((s) => s.status === "STATIC_SNAPSHOT").length,
    awaiting: DATA_SOURCES.filter((s) => s.status === "AWAITING_FEED").length
  };

  return (
    <div className={styles.page}>
      <Panel
        badge={`LIVE ${summary.live} · STATIC ${summary.staticSnapshot} · PENDING ${summary.awaiting}`}
        title="DATA · SOURCES"
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th>NAME</th>
              <th>TYPE</th>
              <th>CADENCE</th>
              <th>STATUS</th>
              <th>NOTES</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((row) => (
              <tr key={row.name}>
                <td className={styles.nameCell}>{row.name}</td>
                <td className={styles.typeCell}>{row.type}</td>
                <td className={styles.cadenceCell}>{row.cadence}</td>
                <td>
                  <span className={`${styles.statusPill} ${statusClass(row.status, styles)}`}>
                    {row.status.replace("_", " ")}
                  </span>
                </td>
                <td className={styles.notesCell}>{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function statusClass(
  status: DataSourceRow["status"],
  stylesMap: Record<string, string>
): string {
  if (status === "LIVE") return stylesMap.statusLive;
  if (status === "STATIC_SNAPSHOT") return stylesMap.statusStatic;
  return stylesMap.statusAwaiting;
}
