import { useEffect } from "react";
import type { CompanyProfile } from "../../types/Infrastructure";
// Reuses the asset overlay CSS module so all four drill-down panels
// (asset, grade, company, country) share exactly the same visual
// shell. CSS modules are scoped by .module.css filename — importing
// from multiple files yields the same hashed class names.
import styles from "../tables/AssetDetailOverlay.module.css";

interface CompanyDetailOverlayProps {
  company: CompanyProfile;
  canGoBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
}

/**
 * Click-to-expand drill-down for the right-rail OPERATOR CONTEXT
 * panel. Shows the full curated company profile in the same shell
 * the asset and grade overlays use, so users get a consistent
 * "click → overlay → read → dismiss" affordance across every
 * clickable surface in the terminal.
 */
export function CompanyDetailOverlay({
  company,
  canGoBack = false,
  onBack,
  onClose
}: CompanyDetailOverlayProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Short datum rows fit the 2-col grid. The long prose summary
  // uses the wrapping full-width variant so it doesn't truncate.
  const datumRows: Array<{ label: string; value: string }> = [
    { label: "DOMICILE", value: company.domicile || "--" },
    { label: "WEBSITE", value: company.website || "--" },
    { label: "TICKERS", value: company.tickers.join(" | ") || "--" },
    { label: "BENCHMARKS", value: company.benchmarks.join(" | ") || "--" }
  ];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          {canGoBack && onBack ? (
            <button
              aria-label="Back to previous overlay"
              className={styles.backButton}
              onClick={onBack}
              title="Back"
              type="button"
            >
              ◀ BACK
            </button>
          ) : null}
          <div className={styles.headerIdentity}>
            <div className={styles.headerKind}>OPERATOR</div>
            <div className={styles.headerName}>{company.name.toUpperCase()}</div>
          </div>
          <button
            aria-label="Close detail panel"
            className={styles.closeButton}
            onClick={onClose}
            title="Close — Esc"
            type="button"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.rowGrid}>
            {datumRows.map(({ label, value }) => (
              <div className={styles.row} key={label}>
                <div className={styles.rowLabel}>{label}</div>
                <div className={styles.rowValue} title={value}>
                  {value}
                </div>
              </div>
            ))}
            {company.summary ? (
              <div className={`${styles.row} ${styles.rowFull}`}>
                <div className={styles.rowLabel}>SUMMARY</div>
                <div className={styles.rowValueWrap}>{company.summary}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            <span>SOURCE: {company.source}</span>
            <span className={styles.separator}>|</span>
            <span>UPDATED: {company.updated}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
