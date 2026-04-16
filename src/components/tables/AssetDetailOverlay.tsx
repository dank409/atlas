import { useEffect } from "react";
import type { ExposureRegistryEntry } from "../../types/Exposure";
import type {
  CompanyProfile,
  CountryProfile,
  InfrastructureAsset
} from "../../types/Infrastructure";
import type { FirmsSnapshot } from "../../types/firms";
import type { OutageEventSnapshot } from "../../types/outageEvent";
import {
  formatCapacityCompact,
  formatLengthKm,
  formatMtpa,
  formatStatusLabel
} from "../../utils/formatters";
import styles from "./AssetDetailOverlay.module.css";

interface AssetDetailOverlayProps {
  asset: InfrastructureAsset;
  /**
   * When true, the header renders a BACK button next to the close
   * affordance. Wired to the overlay navigation stack in App.tsx —
   * true iff the user is currently deeper than one entry.
   */
  canGoBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
  onViewOnMap: (asset: InfrastructureAsset) => void;
  /**
   * Optional profile registries. When supplied, individual rows
   * in the overlay become clickable drill-downs: COUNTRY resolves
   * via `linkedContext.countryCode ?? asset.country` →
   * `countriesByCode`, and OPERATOR / OWNER rows resolve via
   * `linkedContext.companyId` → `companiesById`. A resolved row
   * renders as a button that fires `onInspectCompany` /
   * `onInspectCountry` and opens the corresponding nested overlay.
   * Unresolved rows fall back to plain text — no visual change.
   */
  companiesById?: Record<string, CompanyProfile>;
  countriesByCode?: Record<string, CountryProfile>;
  exposureByTargetId?: Record<string, ExposureRegistryEntry>;
  firmsSnapshot?: FirmsSnapshot | null;
  onInspectCompany?: (company: CompanyProfile) => void;
  onInspectCountry?: (country: CountryProfile) => void;
  outageEvents?: OutageEventSnapshot | null;
}

/**
 * Row-click drill-down for the asset grid. Modeled on the Bloomberg
 * DES-style selector panel: clicking a grid row opens this overlay
 * above the map workspace with every field from the underlying
 * asset. The user can inspect the full record without leaving the
 * grid context, then commit to a map fly-to via "VIEW ON MAP".
 *
 * Inline drill-down: COUNTRY, OPERATOR, and OWNER cells are
 * themselves clickable when the caller supplies profile registries +
 * inspect callbacks. Clicking them fires the nested overlay for the
 * resolved company or country profile, so the user can pivot from
 * "Abadan Refinery" to "Saudi Arabia" to "Saudi Aramco" without
 * touching the right rail or the command bar.
 */
export function AssetDetailOverlay({
  asset,
  canGoBack = false,
  onBack,
  onClose,
  onViewOnMap,
  companiesById,
  countriesByCode,
  exposureByTargetId = {},
  firmsSnapshot = null,
  onInspectCompany,
  onInspectCountry,
  outageEvents = null
}: AssetDetailOverlayProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Resolve the company and country profiles the asset links to.
  // The linkedContext is authored in `workspaceData.ts` and drives
  // the right-rail context panels the same way — we reuse the same
  // keys so there's a single resolution path across the terminal.
  const resolvedCompany = asset.linkedContext?.companyId
    ? companiesById?.[asset.linkedContext.companyId] ?? null
    : null;
  const countryCode = asset.linkedContext?.countryCode ?? asset.country;
  const resolvedCountry = countryCode
    ? countriesByCode?.[countryCode] ?? null
    : null;

  const handleInspectCompanyRow = resolvedCompany && onInspectCompany
    ? () => onInspectCompany(resolvedCompany)
    : undefined;
  const handleInspectCountryRow = resolvedCountry && onInspectCountry
    ? () => onInspectCountry(resolvedCountry)
    : undefined;
  const exposureEntry = exposureByTargetId[asset.id] ?? null;
  const matchedAnomaly =
    firmsSnapshot?.anomalies.find((anomaly) => anomaly.asset.id === asset.id) ?? null;
  const linkedOutageCount = (outageEvents?.events ?? []).filter(
    (event) =>
      event.assetId === asset.id || (!event.assetId && event.country === asset.countryName)
  ).length;

  const rows = buildRows(asset, {
    exposureEntry,
    linkedOutageCount,
    matchedAnomaly,
    onInspectCompany: handleInspectCompanyRow,
    onInspectCountry: handleInspectCountryRow
  });

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
            <div className={styles.headerKind}>{kindLabel(asset)}</div>
            <div className={styles.headerName}>{asset.name.toUpperCase()}</div>
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
            {rows.map((row) => {
              if (row.onClick) {
                return (
                  <button
                    className={`${styles.row} ${styles.rowClickable}`}
                    key={row.label}
                    onClick={row.onClick}
                    title={`Expand ${row.value}`}
                    type="button"
                  >
                    <div className={styles.rowLabel}>{row.label} ▸</div>
                    <div className={styles.rowValue}>{row.value}</div>
                  </button>
                );
              }
              return (
                <div className={styles.row} key={row.label}>
                  <div className={styles.rowLabel}>{row.label}</div>
                  <div className={styles.rowValue} title={row.value}>
                    {row.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            <span>SOURCE: {asset._metadata.source}</span>
            <span className={styles.separator}>|</span>
            <span>CADENCE: QUARTERLY</span>
            <span className={styles.separator}>|</span>
            <span>UPDATED: {asset._metadata.downloadDate}</span>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => {
              onViewOnMap(asset);
              onClose();
            }}
            type="button"
          >
            VIEW ON MAP ▸
          </button>
        </div>
      </div>
    </div>
  );
}

interface DetailRow {
  label: string;
  value: string;
  /**
   * When set, the row renders as a clickable button that fires this
   * callback. Used for fields that resolve to a nested profile
   * (COUNTRY → CountryDetailOverlay, OPERATOR/OWNER →
   * CompanyDetailOverlay). Left undefined for plain data fields.
   */
  onClick?: () => void;
}

interface BuildRowsContext {
  exposureEntry: ExposureRegistryEntry | null;
  linkedOutageCount: number;
  matchedAnomaly: FirmsSnapshot["anomalies"][number] | null;
  onInspectCompany: (() => void) | undefined;
  onInspectCountry: (() => void) | undefined;
}

function buildRows(
  asset: InfrastructureAsset,
  context: BuildRowsContext
): DetailRow[] {
  const {
    exposureEntry,
    linkedOutageCount,
    matchedAnomaly,
    onInspectCompany,
    onInspectCountry
  } = context;

  const rows: DetailRow[] = [
    {
      label: "COUNTRY",
      value: asset.countryName || "--",
      onClick: onInspectCountry
    },
    { label: "STATUS", value: formatStatusLabel(asset.status).toUpperCase() },
    { label: "CADENCE", value: "QUARTERLY" },
    {
      label: "FIRMS SIGNAL",
      value: matchedAnomaly ? `${matchedAnomaly.severity} (${matchedAnomaly.windowCount})` : "NO SIGNAL"
    },
    {
      label: "OUTAGES",
      value: linkedOutageCount > 0 ? `${linkedOutageCount} LINKED` : "NONE LINKED"
    }
  ];

  if (asset.assetKind === "refinery") {
    rows.push(
      {
        label: "CAPACITY",
        value: asset.capacity_bpd ? formatCapacityCompact(asset.capacity_bpd) : "--"
      },
      {
        label: "OPERATOR",
        value: asset.operator || "--",
        onClick: asset.operator ? onInspectCompany : undefined
      },
      {
        label: "OWNER",
        value: asset.owner || "--",
        onClick: asset.owner ? onInspectCompany : undefined
      },
      { label: "TYPE", value: (asset.type || "--").toUpperCase() },
      {
        label: "DEPENDENCY SCORE",
        value:
          typeof asset.hormuzDependency === "number"
            ? `${Math.round(asset.hormuzDependency * 100)}%`
            : "UNSCORED"
      },
      {
        label: "EXPORT ROUTE",
        value:
          exposureEntry && exposureEntry.targetKind === "asset"
            ? exposureEntry.exportRoute ?? "UNSCORED"
            : "UNSCORED"
      },
      {
        label: "CHOKEPOINT",
        value:
          exposureEntry && exposureEntry.targetKind === "asset"
            ? exposureEntry.primaryChokepointLabel ?? "UNSCORED"
            : "UNSCORED"
      },
      {
        label: "MODELED EXP.",
        value:
          exposureEntry &&
          exposureEntry.targetKind === "asset" &&
          typeof exposureEntry.modeledAtRiskMbpd === "number"
            ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
            : "UNSCORED"
      },
      {
        label: "LAT / LON",
        value: `${asset.lat.toFixed(3)}, ${asset.lon.toFixed(3)}`
      }
    );
  }

  if (asset.assetKind === "pipeline") {
    rows.push(
      {
        label: "HYDROCARBON",
        value: asset.hydrocarbon.replaceAll("_", " ").toUpperCase()
      },
      {
        label: "CAPACITY",
        value: asset.capacity_boed ? formatCapacityCompact(asset.capacity_boed) : "--"
      },
      {
        label: "LENGTH",
        value: asset.length_km ? formatLengthKm(asset.length_km) : "--"
      },
      {
        label: "DIAMETER",
        value: asset.diameter_inches ? `${asset.diameter_inches}″` : "--"
      },
      {
        label: "OPERATOR",
        value: asset.operator || "--",
        onClick: asset.operator ? onInspectCompany : undefined
      },
      {
        label: "OWNER",
        value: asset.owner || "--",
        onClick: asset.owner ? onInspectCompany : undefined
      },
      {
        label: "ROUTE",
        value: [asset.startPoint, asset.endPoint].filter(Boolean).join(" → ") || "--"
      },
      {
        label: "MODELED EXP.",
        value:
          exposureEntry &&
          exposureEntry.targetKind === "asset" &&
          typeof exposureEntry.modeledAtRiskMbpd === "number"
            ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
            : "UNSCORED"
      },
      {
        label: "GEOMETRY",
        value: asset.geometryConfidence === "high" ? "SURVEYED" : "SCHEMATIC"
      }
    );
  }

  if (asset.assetKind === "field") {
    rows.push(
      { label: "BASIN", value: asset.basin || "--" },
      { label: "TYPE", value: (asset.fieldType || "--").toUpperCase() },
      {
        label: "PRODUCTION",
        value: asset.production_bpd ? formatCapacityCompact(asset.production_bpd) : "--"
      },
      {
        label: "RESERVES",
        value: asset.reserves_mmboe ? `${asset.reserves_mmboe.toLocaleString()} MMBOE` : "--"
      },
      {
        label: "OPERATOR",
        value: asset.operator || "--",
        onClick: asset.operator ? onInspectCompany : undefined
      },
      {
        label: "LAT / LON",
        value: `${asset.lat.toFixed(3)}, ${asset.lon.toFixed(3)}`
      },
      {
        label: "MODELED EXP.",
        value:
          exposureEntry &&
          exposureEntry.targetKind === "asset" &&
          typeof exposureEntry.modeledAtRiskMbpd === "number"
            ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
            : "UNSCORED"
      }
    );
  }

  if (asset.assetKind === "terminal") {
    rows.push(
      {
        label: "ROLE",
        value: (asset.terminalRole || asset.terminalType || "--")
          .replaceAll("_", " ")
          .toUpperCase()
      },
      {
        label: "CAPACITY",
        value: asset.capacity_mtpa
          ? formatMtpa(asset.capacity_mtpa)
          : asset.capacity_bpd
            ? formatCapacityCompact(asset.capacity_bpd)
            : "--"
      },
      {
        label: "STORAGE",
        value: asset.storageCap_mmbbl ? `${asset.storageCap_mmbbl.toLocaleString()} MMBBL` : "--"
      },
      {
        label: "OPERATOR",
        value: asset.operator || "--",
        onClick: asset.operator ? onInspectCompany : undefined
      },
      {
        label: "OWNER",
        value: asset.owner || "--",
        onClick: asset.owner ? onInspectCompany : undefined
      },
      {
        label: "LAT / LON",
        value: `${asset.lat.toFixed(3)}, ${asset.lon.toFixed(3)}`
      },
      {
        label: "EXPORT ROUTE",
        value:
          exposureEntry && exposureEntry.targetKind === "asset"
            ? exposureEntry.exportRoute ?? "UNSCORED"
            : "UNSCORED"
      }
    );
  }

  if (asset.assetKind === "chokepoint") {
    rows.push(
      {
        label: "TRANSIT",
        value: `${asset.transitVolume_mbpd.toFixed(1)} MBPD`
      },
      {
        label: "BENCHMARKS",
        value: asset.linkedContext?.benchmarkRefs?.join(" | ") || "--"
      },
      {
        label: "BYPASS CAP.",
        value:
          exposureEntry &&
          exposureEntry.targetKind === "chokepoint" &&
          typeof exposureEntry.bypassCapacityMbpd === "number"
            ? `${exposureEntry.bypassCapacityMbpd.toFixed(1)} MBPD`
            : "UNSCORED"
      },
      {
        label: "AT-RISK FLOW",
        value:
          exposureEntry &&
          exposureEntry.targetKind === "chokepoint" &&
          typeof exposureEntry.modeledAtRiskMbpd === "number"
            ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
            : "UNSCORED"
      }
    );
  }

  return rows;
}

function kindLabel(asset: InfrastructureAsset): string {
  switch (asset.assetKind) {
    case "refinery":
      return "REFINERY";
    case "pipeline":
      return "PIPELINE";
    case "field":
      return "OIL & GAS FIELD";
    case "terminal":
      return "TERMINAL / LNG";
    case "chokepoint":
      return "CHOKEPOINT";
    default:
      return "ASSET";
  }
}
