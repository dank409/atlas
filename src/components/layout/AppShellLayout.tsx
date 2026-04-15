import type { ReactNode } from "react";
import styles from "./AppShellLayout.module.css";

interface AppShellLayoutProps {
  header: ReactNode;
  isLeftSidebarOpen?: boolean;
  isRightSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  leftSidebar: ReactNode;
  mainContent: ReactNode;
  marketTape?: ReactNode;
  rightSidebar: ReactNode;
  statusBar: ReactNode;
  children?: ReactNode;
}

export function AppShellLayout({
  header,
  isLeftSidebarOpen = true,
  isRightSidebarOpen = true,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  leftSidebar,
  mainContent,
  marketTape,
  rightSidebar,
  statusBar,
  children
}: AppShellLayoutProps) {
  const shellClassName = [
    styles.shell,
    !isLeftSidebarOpen ? styles.shellLeftRail : "",
    !isRightSidebarOpen ? styles.shellRightRail : "",
    marketTape ? styles.shellWithTape : ""
  ]
    .filter(Boolean)
    .join(" ");

  // Collapse affordance lives INSIDE each sidebar column, never in
  // the main viewport. When open, the sidebar is a flex column with
  // a 24px header strip (collapse button + "CATALOG" / "CONTEXT"
  // label) and a scrollable body — same pattern as the asset grid
  // panel. When collapsed, the column shrinks to a 22px rail whose
  // sole child is the expand button.
  return (
    <div className={shellClassName}>
      <header className={styles.header}>{header}</header>
      {marketTape ? <div className={styles.marketTape}>{marketTape}</div> : null}
      <aside
        className={[styles.leftSidebar, !isLeftSidebarOpen ? styles.sidebarRail : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {isLeftSidebarOpen ? (
          <>
            <div className={styles.sidebarStrip}>
              <span className={styles.sidebarStripLabel}>CATALOG</span>
              {onToggleLeftSidebar ? (
                <button
                  aria-label="Collapse catalog sidebar"
                  className={styles.sidebarStripButton}
                  onClick={onToggleLeftSidebar}
                  title="Collapse catalog — ["
                  type="button"
                >
                  ◀
                </button>
              ) : null}
            </div>
            <div className={styles.sidebarBody}>{leftSidebar}</div>
          </>
        ) : onToggleLeftSidebar ? (
          <button
            aria-label="Expand catalog sidebar"
            className={styles.sidebarRailButton}
            onClick={onToggleLeftSidebar}
            title="Expand catalog — ["
            type="button"
          >
            ▶
          </button>
        ) : null}
      </aside>
      <main className={styles.mainViewport}>
        <div className={styles.mainInner}>
          {mainContent}
          {children}
        </div>
      </main>
      <aside
        className={[styles.rightSidebar, !isRightSidebarOpen ? styles.sidebarRail : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {isRightSidebarOpen ? (
          <>
            <div className={styles.sidebarStrip}>
              {onToggleRightSidebar ? (
                <button
                  aria-label="Collapse context sidebar"
                  className={styles.sidebarStripButton}
                  onClick={onToggleRightSidebar}
                  title="Collapse context — ]"
                  type="button"
                >
                  ▶
                </button>
              ) : null}
              <span className={styles.sidebarStripLabel}>CONTEXT</span>
            </div>
            <div className={styles.sidebarBody}>{rightSidebar}</div>
          </>
        ) : onToggleRightSidebar ? (
          <button
            aria-label="Expand context sidebar"
            className={styles.sidebarRailButton}
            onClick={onToggleRightSidebar}
            title="Expand context — ]"
            type="button"
          >
            ◀
          </button>
        ) : null}
      </aside>
      <footer className={styles.statusBar}>{statusBar}</footer>
    </div>
  );
}
