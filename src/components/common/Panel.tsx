import type { ReactNode } from "react";
import styles from "./Panel.module.css";

interface PanelProps {
  title: string;
  badge?: string;
  /**
   * Optional element rendered flush-right in the panel header, after
   * the badge. Used for in-panel controls like collapse buttons.
   */
  trailing?: ReactNode;
  /**
   * Extra class name applied to the outer section, merged with the
   * base panel class. Callers use this to position the panel inside
   * a CSS grid (e.g. `grid-column: span 2`) without introducing an
   * extra wrapper div per panel.
   */
  className?: string;
  /**
   * When supplied, the panel header becomes a click target that
   * opens a full-screen "expand" view of the panel. Used by the
   * dashboard so every tile can be clicked to read its contents
   * at full size. Adds a ▸ glyph after the badge as a visible cue.
   * The inner panel body is NOT wrapped — interactive elements
   * inside (sliders, buttons, row clicks) keep working normally.
   */
  onExpand?: () => void;
  children: ReactNode;
}

export function Panel({
  title,
  badge,
  trailing,
  className,
  onExpand,
  children
}: PanelProps) {
  const sectionClassName = className ? `${styles.panel} ${className}` : styles.panel;

  const headerContent = (
    <>
      <span className={styles.title}>{title}</span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      {onExpand ? (
        <span className={styles.expandGlyph} aria-hidden="true">
          ▸
        </span>
      ) : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </>
  );

  return (
    <section className={sectionClassName}>
      {onExpand ? (
        <button
          aria-label={`Expand ${title} panel`}
          className={`${styles.header} ${styles.headerClickable}`}
          onClick={onExpand}
          title={`Expand ${title}`}
          type="button"
        >
          {headerContent}
        </button>
      ) : (
        <header className={styles.header}>{headerContent}</header>
      )}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
