import { useEffect } from "react";
import type { CrudeGrade } from "../../types/CrudeGrade";
// Reuses the asset overlay's CSS module so the two drill-down panels
// are visually identical. CSS modules are scoped by the .module.css
// filename, not by the importing file — importing the same module
// from two components yields the same class names.
import styles from "./AssetDetailOverlay.module.css";

interface GradeDetailOverlayProps {
  grade: CrudeGrade;
  canGoBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
}

/**
 * Row-click drill-down for the crude grade reference table. Mirrors
 * `AssetDetailOverlay` but for `CrudeGrade` records. The GRADES view
 * has no "VIEW ON MAP" action because grades are not geographic
 * entities — they are assay + pricing metadata — so the footer is
 * source attribution only.
 */
export function GradeDetailOverlay({
  grade,
  canGoBack = false,
  onBack,
  onClose
}: GradeDetailOverlayProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Datum rows (short, fit the 2-col grid) and prose rows (full-width,
  // wrap) are split so we can render them with different row variants
  // without sprinkling conditionals in the JSX.
  const datumRows: Array<{ label: string; value: string }> = [
    { label: "PRODUCER", value: grade.producer.toUpperCase() },
    { label: "ISO", value: grade.producerIso },
    { label: "API°", value: grade.apiGravity.toFixed(1) },
    { label: "SULFUR %", value: grade.sulfurPct.toFixed(2) },
    {
      label: "CLASS",
      value: grade.classification.replace("-", " ").toUpperCase()
    },
    {
      label: "PRODUCTION",
      value: `${grade.productionMbpd.toFixed(2)} MBPD`
    }
  ];

  const proseRows: Array<{ label: string; value: string }> = [
    { label: "PRICING REF", value: grade.pricingRef },
    { label: "NOTE", value: grade.note }
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
            <div className={styles.headerKind}>CRUDE GRADE</div>
            <div className={styles.headerName}>{grade.name.toUpperCase()}</div>
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
            {proseRows.map(({ label, value }) => (
              <div
                className={`${styles.row} ${styles.rowFull}`}
                key={label}
              >
                <div className={styles.rowLabel}>{label}</div>
                <div className={styles.rowValueWrap}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            <span>ID: {grade.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
