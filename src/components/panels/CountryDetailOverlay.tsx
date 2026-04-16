import { useEffect } from "react";
import type { ExposureRegistryEntry } from "../../types/Exposure";
import type { CountryProfile } from "../../types/Infrastructure";
import styles from "../tables/AssetDetailOverlay.module.css";

interface CountryDetailOverlayProps {
  country: CountryProfile;
  canGoBack?: boolean;
  exposureEntry?: ExposureRegistryEntry | null;
  onBack?: () => void;
  onClose: () => void;
}

/**
 * Click-to-expand drill-down for the right-rail COUNTRY CONTEXT
 * panel. Surfaces every curated field on `CountryProfile`, including
 * the optional P1 extensions (bypassCapacityMbpd, keyRefineriesBpd,
 * chokepointScores, keyExportTerminals) that the right-rail panel
 * itself does not render.
 */
export function CountryDetailOverlay({
  country,
  canGoBack = false,
  exposureEntry = null,
  onBack,
  onClose
}: CountryDetailOverlayProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const datumRows: Array<{ label: string; value: string }> = [
    { label: "ISO", value: country.code },
    { label: "KEY GRADES", value: country.keyGrades.join(" | ") || "--" }
  ];

  if (typeof country.bypassCapacityMbpd === "number") {
    datumRows.push({
      label: "BYPASS CAP.",
      value: `${country.bypassCapacityMbpd.toFixed(1)} MBPD`
    });
  }
  if (typeof country.keyRefineriesBpd === "number") {
    datumRows.push({
      label: "REFINING CAP.",
      value: `${(country.keyRefineriesBpd / 1000).toFixed(0)}K BPD`
    });
  }
  datumRows.push({
    label: "SEABORNE EXPORTS",
    value:
      exposureEntry &&
      exposureEntry.targetKind === "country" &&
      typeof exposureEntry.seaborneExportsMbpd === "number"
        ? `${exposureEntry.seaborneExportsMbpd.toFixed(1)} MBPD`
        : "UNSCORED"
  });
  datumRows.push({
    label: "MODELED AT-RISK",
    value:
      exposureEntry &&
      exposureEntry.targetKind === "country" &&
      typeof exposureEntry.modeledAtRiskMbpd === "number"
        ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
        : "UNSCORED"
  });
  datumRows.push({
    label: "PRIMARY CHOKEPOINT",
    value:
      exposureEntry && exposureEntry.targetKind === "country"
        ? exposureEntry.primaryChokepointLabel ?? "UNSCORED"
        : "UNSCORED"
  });

  const chokepointRows: Array<{ label: string; value: string }> = [];
  if (country.chokepointScores) {
    const { hormuz, babElMandeb, suez } = country.chokepointScores;
    chokepointRows.push(
      { label: "HORMUZ DEP.", value: `${Math.round(hormuz * 100)}%` },
      { label: "BAB EL-MANDEB", value: `${Math.round(babElMandeb * 100)}%` },
      { label: "SUEZ DEP.", value: `${Math.round(suez * 100)}%` }
    );
  }

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
            <div className={styles.headerKind}>COUNTRY</div>
            <div className={styles.headerName}>{country.name.toUpperCase()}</div>
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
            {chokepointRows.map(({ label, value }) => (
              <div className={styles.row} key={label}>
                <div className={styles.rowLabel}>{label}</div>
                <div className={styles.rowValue} title={value}>
                  {value}
                </div>
              </div>
            ))}
            {country.summary ? (
              <div className={`${styles.row} ${styles.rowFull}`}>
                <div className={styles.rowLabel}>SUMMARY</div>
                <div className={styles.rowValueWrap}>{country.summary}</div>
              </div>
            ) : null}
            {country.chokepointDependency ? (
              <div className={`${styles.row} ${styles.rowFull}`}>
                <div className={styles.rowLabel}>CHOKEPOINT DEPENDENCY</div>
                <div className={styles.rowValueWrap}>
                  {country.chokepointDependency}
                </div>
              </div>
            ) : null}
            {country.keyExportTerminals && country.keyExportTerminals.length > 0 ? (
              <div className={`${styles.row} ${styles.rowFull}`}>
                <div className={styles.rowLabel}>KEY EXPORT TERMINALS</div>
                <div className={styles.rowValueWrap}>
                  {country.keyExportTerminals.join(" · ")}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            <span>SOURCE: {country.source}</span>
            <span className={styles.separator}>|</span>
            <span>CADENCE: CURATED</span>
            <span className={styles.separator}>|</span>
            <span>UPDATED: {country.updated}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
