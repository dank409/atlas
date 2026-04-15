import { useEffect, type ReactNode } from "react";
// Reuses the asset-overlay CSS module so all full-screen overlays
// share one visual shell. CSS modules are scoped by filename so
// importing from multiple files yields the same hashed classes.
import styles from "../tables/AssetDetailOverlay.module.css";
import dashStyles from "./DashboardTileOverlay.module.css";

interface DashboardTileOverlayProps {
  title: string;
  kindLabel?: string;
  badge?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Full-screen expansion modal for any dashboard tile. Same chrome
 * as AssetDetailOverlay / CountryDetailOverlay (backdrop, header,
 * close button, Escape-to-dismiss) but accepts arbitrary children
 * and sizes itself to 90% of the viewport so charts actually have
 * room to read. No back button — tile expansion is a leaf
 * operation, not part of the app-wide overlay navigation stack.
 */
export function DashboardTileOverlay({
  title,
  kindLabel = "TILE",
  badge,
  onClose,
  children
}: DashboardTileOverlayProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.panel} ${dashStyles.wide}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerKind}>
              {kindLabel}
              {badge ? ` · ${badge}` : ""}
            </div>
            <div className={styles.headerName}>{title}</div>
          </div>
          <button
            aria-label="Close expanded tile"
            className={styles.closeButton}
            onClick={onClose}
            title="Close — Esc"
            type="button"
          >
            ×
          </button>
        </div>
        <div className={`${styles.body} ${dashStyles.wideBody}`}>{children}</div>
      </div>
    </div>
  );
}
