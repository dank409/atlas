import type { ReactNode } from "react";
import styles from "./DetailCard.module.css";

export interface DetailCardRow {
  label: string;
  value: string;
  /** Rows that lead somewhere (a linked profile) render as a button. */
  onClick?: () => void;
  /** Long text: label above, value below, instead of side by side. */
  isProse?: boolean;
}

interface DetailCardProps {
  /** Small amber label above the name, e.g. `REFINERY`. */
  kind: string;
  name: string;
  rows: DetailCardRow[];
  /** Attribution line. */
  footer: ReactNode;
  /** Optional `◀` link above the header, e.g. back to the asset this profile was opened from. */
  back?: { label: string; onClick: () => void };
  /** Optional button under the rows. */
  action?: { label: string; onClick: () => void };
  /** Shows a × in the header when supplied. */
  onClose?: () => void;
  closeLabel?: string;
  /** Extra sections (lists, links) shown under the rows. */
  children?: ReactNode;
}

/**
 * The one card used for anything inspected in detail: a map asset, a
 * country, an operator, a crude grade. Missing values are passed in as `--`.
 */
export function DetailCard({
  kind,
  name,
  rows,
  footer,
  back,
  action,
  onClose,
  closeLabel = "Close",
  children
}: DetailCardProps) {
  return (
    <section aria-label={`${kind} ${name}`} className={styles.card}>
      {back ? (
        <button className={styles.backButton} onClick={back.onClick} type="button">
          ◀ {back.label}
        </button>
      ) : null}
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.kind}>{kind}</div>
          <div className={styles.name}>{name}</div>
        </div>
        {onClose ? (
          <button aria-label={closeLabel} className={styles.closeButton} onClick={onClose} type="button">
            ×
          </button>
        ) : null}
      </header>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div className={row.isProse ? styles.proseRow : styles.row} key={row.label}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={styles.value}>
              {row.onClick ? (
                <button className={styles.linkButton} onClick={row.onClick} type="button">
                  {row.value} ▸
                </button>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {children}
      {action ? (
        <div className={styles.actions}>
          <button className={styles.actionButton} onClick={action.onClick} type="button">
            {action.label}
          </button>
        </div>
      ) : null}
      <footer className={styles.footer}>{footer}</footer>
    </section>
  );
}
