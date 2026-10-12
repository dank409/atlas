import type { ReactNode } from "react";
import styles from "./AppShellLayout.module.css";

interface CollapsibleSidebar {
  content: ReactNode;
  isOpen: boolean;
  /** Names the column in the collapse / expand button labels, e.g. `controls`. */
  label: string;
  onToggle: () => void;
}

interface AppShellLayoutProps {
  header: ReactNode;
  /** Omit for pages that have no controls column. */
  leftSidebar?: CollapsibleSidebar;
  mainContent: ReactNode;
  /** Detail column. Only pass it when there is something to show; it has no empty state. */
  rightSidebar?: ReactNode;
  statusBar: ReactNode;
}

export function AppShellLayout({ header, leftSidebar, mainContent, rightSidebar, statusBar }: AppShellLayoutProps) {
  const shellClassName = [
    styles.shell,
    leftSidebar ? (leftSidebar.isOpen ? styles.leftOpen : styles.leftCollapsed) : "",
    rightSidebar ? styles.rightOpen : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <header className={styles.header}>{header}</header>
      {leftSidebar ? <LeftSidebar sidebar={leftSidebar} /> : null}
      <main className={styles.mainViewport}>{mainContent}</main>
      {rightSidebar ? <aside className={styles.rightSidebar}>{rightSidebar}</aside> : null}
      <footer className={styles.statusBar}>{statusBar}</footer>
    </div>
  );
}

function LeftSidebar({ sidebar }: { sidebar: CollapsibleSidebar }) {
  if (!sidebar.isOpen) {
    return (
      <aside className={styles.leftSidebar}>
        <button
          aria-label={`Expand ${sidebar.label} sidebar`}
          className={styles.sidebarRailButton}
          onClick={sidebar.onToggle}
          type="button"
        >
          ▶
        </button>
      </aside>
    );
  }

  return (
    <aside className={styles.leftSidebar}>
      <div className={styles.sidebarBody}>{sidebar.content}</div>
      <button
        aria-label={`Collapse ${sidebar.label} sidebar`}
        className={styles.sidebarCollapseButton}
        onClick={sidebar.onToggle}
        type="button"
      >
        ◀ HIDE
      </button>
    </aside>
  );
}
