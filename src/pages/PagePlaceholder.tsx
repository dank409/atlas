import type { ReactNode } from "react";
import styles from "./PagePlaceholder.module.css";

interface PagePlaceholderProps {
  /** Short code shown top-left (e.g. "P/2" for phase 2 of this view). */
  phase?: string;
  /** View title rendered in terminal-amber caps. */
  title: string;
  /** Secondary status line rendered below the title in muted grey. */
  statusLine: string;
  /** One-paragraph description of what the view will do when shipped. */
  summary: string;
  /** Honest list of data dependencies that still need to be wired. */
  dependencies: string[];
  /** Optional CTA / note rendered below the dependency list. */
  note?: ReactNode;
}

/**
 * Honest placeholder used for pages whose data feeds are not yet
 * wired (AIS, parts of CHOKES, FLOWS Sankey, etc.). Deliberately
 * blunt about what's missing so the user never confuses a
 * placeholder with real live data — see CLAUDE.md Data Integrity
 * Rule #1 "Never fabricate data."
 */
export function PagePlaceholder({
  phase,
  title,
  statusLine,
  summary,
  dependencies,
  note
}: PagePlaceholderProps) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.header}>
        {phase ? <span className={styles.phase}>{phase}</span> : null}
        <span className={styles.title}>{title}</span>
        <span className={styles.awaitingBadge}>AWAITING FEED</span>
      </div>
      <div className={styles.statusLine}>{statusLine}</div>
      <div className={styles.summary}>{summary}</div>
      <div className={styles.dependenciesHeader}>DEPENDENCIES</div>
      <ul className={styles.dependencyList}>
        {dependencies.map((dep) => (
          <li className={styles.dependencyItem} key={dep}>
            <span className={styles.dependencyBullet}>›</span>
            {dep}
          </li>
        ))}
      </ul>
      {note ? <div className={styles.note}>{note}</div> : null}
    </div>
  );
}
