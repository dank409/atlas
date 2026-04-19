import { useEffect, useState } from "react";
import { Panel } from "../components/common/Panel";
import styles from "./AlertsPage.module.css";

const STORAGE_KEY = "atlas.alerts.v1";

type AlertOp = ">" | "<" | ">=" | "<=" | "==";
type AlertSubject =
  | "BRENT"
  | "WTI"
  | "DUBAI"
  | "MURBAN"
  | "BRENT_WTI_SPREAD"
  | "HORMUZ_7D_PCT"
  | "RED_SEA_WAR_RISK";
type AlertStatus = "ARMED" | "TRIGGERED" | "PAUSED";
type AlertChannel = "EMAIL" | "SLACK" | "SMS" | "WEBHOOK";

interface AlertRule {
  id: string;
  name: string;
  subject: AlertSubject;
  op: AlertOp;
  threshold: number;
  status: AlertStatus;
  channels: AlertChannel[];
  hits: number;
  createdAt: string;
}

const SUBJECT_OPTIONS: { id: AlertSubject; label: string }[] = [
  { id: "BRENT", label: "BRENT" },
  { id: "WTI", label: "WTI" },
  { id: "DUBAI", label: "DUBAI" },
  { id: "MURBAN", label: "MURBAN" },
  { id: "BRENT_WTI_SPREAD", label: "BRENT · WTI SPREAD" },
  { id: "HORMUZ_7D_PCT", label: "HORMUZ 7D PCT" },
  { id: "RED_SEA_WAR_RISK", label: "RED SEA WAR-RISK" }
];

const CHANNELS: AlertChannel[] = ["EMAIL", "SLACK", "SMS", "WEBHOOK"];

interface AlertsPageProps {
  /** Called each time the user arms a new alert — parent logs activity. */
  onAlertCreated?: (rule: AlertRule) => void;
}

/**
 * Terminal-style rule engine UI. Rules are persisted to localStorage
 * only — no server-side evaluation or notification backend exists
 * yet, so the panel is honest: each rule shows an ARMED/TRIGGERED/
 * PAUSED badge but the TRIGGERED state must be set by hand. When the
 * evaluator ships it will flip statuses automatically against the
 * live data feed.
 */
export function AlertsPage({ onAlertCreated }: AlertsPageProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<AlertSubject>("BRENT");
  const [op, setOp] = useState<AlertOp>(">");
  const [threshold, setThreshold] = useState("90");
  const [activeChannels, setActiveChannels] = useState<AlertChannel[]>(["EMAIL"]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setRules(JSON.parse(raw) as AlertRule[]);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {
      /* quota exceeded — the UI still works in-memory */
    }
  }, [rules]);

  function toggleChannel(ch: AlertChannel) {
    setActiveChannels((current) =>
      current.includes(ch) ? current.filter((c) => c !== ch) : [...current, ch]
    );
  }

  function createAlert() {
    const parsedThreshold = Number.parseFloat(threshold);
    if (!name.trim() || Number.isNaN(parsedThreshold)) return;
    const rule: AlertRule = {
      id: `alert-${Date.now()}`,
      name: name.trim(),
      subject,
      op,
      threshold: parsedThreshold,
      status: "ARMED",
      channels: activeChannels,
      hits: 0,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    setRules((current) => [rule, ...current]);
    setName("");
    onAlertCreated?.(rule);
  }

  function removeAlert(id: string) {
    setRules((current) => current.filter((r) => r.id !== id));
  }

  function togglePause(id: string) {
    setRules((current) =>
      current.map((r) =>
        r.id === id
          ? { ...r, status: r.status === "PAUSED" ? "ARMED" : "PAUSED" }
          : r
      )
    );
  }

  const armedCount = rules.filter((r) => r.status === "ARMED").length;
  const triggeredCount = rules.filter((r) => r.status === "TRIGGERED").length;

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <Panel
          badge={`${rules.length} RULES · ${armedCount} ARMED · ${triggeredCount} TRIGGERED`}
          title="ACTIVE ALERTS"
        >
          {rules.length === 0 ? (
            <div className={styles.empty}>
              NO ALERTS DEFINED · USE THE CREATE PANEL TO ARM YOUR FIRST RULE
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>CONDITION</th>
                  <th>STATUS</th>
                  <th>HITS</th>
                  <th>CREATED</th>
                  <th>CHANNELS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr className={styles.row} key={rule.id}>
                    <td className={styles.nameCell}>{rule.name}</td>
                    <td className={styles.conditionCell}>
                      {rule.subject}.{opMethodLabel(rule.subject)} {rule.op} {rule.threshold}
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${statusClass(rule.status, styles)}`}>
                        {rule.status}
                      </span>
                    </td>
                    <td className={styles.numericCell}>{rule.hits}</td>
                    <td className={styles.numericCell}>{rule.createdAt}</td>
                    <td className={styles.channelCell}>{rule.channels.join(" · ")}</td>
                    <td>
                      <button
                        className={styles.rowButton}
                        onClick={() => togglePause(rule.id)}
                        type="button"
                      >
                        {rule.status === "PAUSED" ? "ARM" : "PAUSE"}
                      </button>
                      <button
                        className={styles.rowButton}
                        onClick={() => removeAlert(rule.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <aside className={styles.aside}>
        <Panel title="CREATE ALERT">
          <label className={styles.field}>
            <span className={styles.fieldLabel}>NAME</span>
            <input
              className={styles.input}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brent above 90"
              type="text"
              value={name}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>SUBJECT</span>
            <select
              className={styles.select}
              onChange={(e) => setSubject(e.target.value as AlertSubject)}
              value={subject}
            >
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>OP</span>
              <select
                className={styles.select}
                onChange={(e) => setOp(e.target.value as AlertOp)}
                value={op}
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="==">==</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>THRESHOLD</span>
              <input
                className={styles.input}
                onChange={(e) => setThreshold(e.target.value)}
                type="number"
                value={threshold}
              />
            </label>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>CHANNELS</span>
            <div className={styles.channelGroup}>
              {CHANNELS.map((ch) => (
                <button
                  aria-pressed={activeChannels.includes(ch)}
                  className={
                    activeChannels.includes(ch)
                      ? styles.channelButtonActive
                      : styles.channelButton
                  }
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  type="button"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <button className={styles.createButton} onClick={createAlert} type="button">
            CREATE &amp; ARM
          </button>

          <div className={styles.disclaimer}>
            Rules persist to localStorage only. Automated evaluation
            against the live market feed is a follow-up feature —
            current alerts are definitions, not a running engine.
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function opMethodLabel(subject: AlertSubject): string {
  if (subject === "HORMUZ_7D_PCT") return "7d_pct";
  if (subject === "RED_SEA_WAR_RISK") return "war_risk";
  if (subject === "BRENT_WTI_SPREAD") return "spread";
  return "last";
}

function statusClass(status: AlertStatus, stylesMap: Record<string, string>): string {
  if (status === "ARMED") return stylesMap.statusArmed;
  if (status === "TRIGGERED") return stylesMap.statusTriggered;
  return stylesMap.statusPaused;
}
