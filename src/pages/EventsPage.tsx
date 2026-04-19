import { useMemo, useState } from "react";
import { Panel } from "../components/common/Panel";
import { RiskFeedModule } from "../components/market/RiskFeedModule";
import type { FirmsFacilityAnomaly } from "../types/firms";
import type { OutageEvent } from "../types/outageEvent";
import styles from "./EventsPage.module.css";

interface EventsPageProps {
  outageEvents: OutageEvent[];
  firmsAnomalies: FirmsFacilityAnomaly[];
  /**
   * Timeline playhead [0, 1]. When < 1, events dated after the
   * corresponding historical cutoff are dimmed rather than hidden —
   * the full event set stays visible so the user can see what's
   * ahead. Optional; the page renders at full fidelity when omitted.
   */
  timeT?: number;
}

type ViewMode = "feed" | "swimlane";

const COUNTRY_LANE_ORDER = ["SA", "AE", "KW", "QA", "OM", "IR", "IQ", "YE", "EG", "SY", "TR"];

export function EventsPage({ outageEvents, firmsAnomalies, timeT = 1 }: EventsPageProps) {
  const [mode, setMode] = useState<ViewMode>("feed");

  // When rewound, compute the virtual "now" (`cutoffMs`) and filter
  // future events out of both feed and swimlane views so the page
  // only shows events the user would have known about at that time.
  const cutoffMs = useMemo(() => {
    if (timeT >= 0.999 || outageEvents.length === 0) return Infinity;
    const sortedDates = outageEvents.map((e) => Date.parse(`${e.date}T00:00:00Z`));
    const earliest = Math.min(...sortedDates);
    const latest = Math.max(...sortedDates);
    return earliest + (latest - earliest) * timeT;
  }, [outageEvents, timeT]);

  const visibleOutages = useMemo(
    () => outageEvents.filter((e) => Date.parse(`${e.date}T00:00:00Z`) <= cutoffMs),
    [outageEvents, cutoffMs]
  );

  const countries = useMemo(() => {
    const present = new Set(visibleOutages.map((e) => e.country));
    // Stable ordering: curated order first, then alphabetical for stragglers.
    return [
      ...COUNTRY_LANE_ORDER.filter((c) => present.has(c)),
      ...Array.from(present)
        .filter((c) => !COUNTRY_LANE_ORDER.includes(c))
        .sort()
    ];
  }, [visibleOutages]);

  const sortedEvents = useMemo(
    () => [...visibleOutages].sort((a, b) => a.date.localeCompare(b.date)),
    [visibleOutages]
  );

  const { earliest, latest } = useMemo(() => {
    if (sortedEvents.length === 0) {
      return { earliest: 0, latest: 1 };
    }
    return {
      earliest: Date.parse(`${sortedEvents[0].date}T00:00:00Z`),
      latest: Date.parse(`${sortedEvents[sortedEvents.length - 1].date}T00:00:00Z`)
    };
  }, [sortedEvents]);

  return (
    <div className={styles.page}>
      <div className={styles.modeSwitcher}>
        <button
          aria-pressed={mode === "feed"}
          className={mode === "feed" ? styles.modeButtonActive : styles.modeButton}
          onClick={() => setMode("feed")}
          type="button"
        >
          FEED
        </button>
        <button
          aria-pressed={mode === "swimlane"}
          className={mode === "swimlane" ? styles.modeButtonActive : styles.modeButton}
          onClick={() => setMode("swimlane")}
          type="button"
        >
          SWIMLANE
        </button>
      </div>

      <div className={styles.content}>
        {mode === "feed" ? (
          <RiskFeedModule
            firmsAnomalies={timeT >= 0.999 ? firmsAnomalies : []}
            limit={40}
            outageEvents={visibleOutages}
          />
        ) : (
          <Panel
            badge={`${sortedEvents.length} EVENTS · ${countries.length} COUNTRIES`}
            title="EVENT SWIMLANE"
          >
            <SwimlaneChart
              countries={countries}
              earliest={earliest}
              events={sortedEvents}
              latest={latest}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}

interface SwimlaneChartProps {
  countries: string[];
  events: OutageEvent[];
  earliest: number;
  latest: number;
}

function SwimlaneChart({ countries, events, earliest, latest }: SwimlaneChartProps) {
  const span = Math.max(latest - earliest, 1);

  return (
    <div className={styles.swimlane}>
      <div className={styles.axisRow}>
        <div className={styles.laneHeader} />
        <div className={styles.axisTrack}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const date = new Date(earliest + span * t).toISOString().slice(0, 7);
            return (
              <div
                className={styles.axisTick}
                key={t}
                style={{ left: `${t * 100}%` }}
              >
                <div className={styles.axisTickLine} />
                <span className={styles.axisTickLabel}>{date}</span>
              </div>
            );
          })}
        </div>
      </div>
      {countries.map((country) => {
        const lane = events.filter((e) => e.country === country);
        return (
          <div className={styles.lane} key={country}>
            <div className={styles.laneHeader}>{country}</div>
            <div className={styles.laneTrack}>
              {lane.map((event) => {
                const t = Date.parse(`${event.date}T00:00:00Z`);
                const pct = ((t - earliest) / span) * 100;
                return (
                  <div
                    className={`${styles.laneDot} ${severityClass(event.severity, styles)}`}
                    key={event.id}
                    style={{ left: `${pct.toFixed(2)}%` }}
                    title={`${event.date} · ${event.severity} · ${event.name}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function severityClass(
  severity: OutageEvent["severity"],
  stylesMap: Record<string, string>
): string {
  if (severity === "CRITICAL") return stylesMap.dotCritical;
  if (severity === "HIGH") return stylesMap.dotHigh;
  if (severity === "MEDIUM") return stylesMap.dotMed;
  return stylesMap.dotLow;
}
