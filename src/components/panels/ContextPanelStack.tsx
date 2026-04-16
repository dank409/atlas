import { Panel } from "../common/Panel";
import {
  formatCadenceLabel,
  formatClassificationLabel
} from "../../types/DataSource";
import type { ExposureRegistryEntry } from "../../types/Exposure";
import type {
  CompanyProfile,
  CountryProfile,
  InfrastructureAsset
} from "../../types/Infrastructure";
import type { FirmsSnapshot } from "../../types/firms";
import type { OutageEventSnapshot } from "../../types/outageEvent";
import {
  formatCapacity,
  formatLengthKm,
  formatMtpa,
  formatStatusLabel,
  formatTransitVolume
} from "../../utils/formatters";
import { getAssetTypeLabel } from "../../utils/infrastructure";
import styles from "./ContextPanelStack.module.css";

interface ContextPanelStackProps {
  companiesById: Record<string, CompanyProfile>;
  countriesByCode: Record<string, CountryProfile>;
  exposureByTargetId?: Record<string, ExposureRegistryEntry>;
  firmsSnapshot?: FirmsSnapshot | null;
  onInspectCompany?: (company: CompanyProfile) => void;
  onInspectCountry?: (country: CountryProfile) => void;
  outageEvents?: OutageEventSnapshot | null;
  selectedAsset: InfrastructureAsset | null;
}

export function ContextPanelStack({
  countriesByCode,
  exposureByTargetId = {},
  firmsSnapshot = null,
  outageEvents = null,
  selectedAsset
}: ContextPanelStackProps) {
  const countryCode = selectedAsset?.linkedContext?.countryCode ?? selectedAsset?.country;
  const country = countryCode ? countriesByCode[countryCode] ?? null : null;
  const exposureEntry = selectedAsset ? exposureByTargetId[selectedAsset.id] ?? null : null;
  const countryExposure = country ? exposureByTargetId[country.code] ?? null : null;
  const matchedAnomaly = selectedAsset
    ? firmsSnapshot?.anomalies.find((anomaly) => anomaly.asset.id === selectedAsset.id) ?? null
    : null;
  const linkedOutages = selectedAsset
    ? (outageEvents?.events ?? []).filter(
        (event) =>
          event.assetId === selectedAsset.id || (!event.assetId && event.country === selectedAsset.countryName)
      )
    : [];

  return (
    <div className={styles.stack}>
      <Panel
        title="STRUCTURAL PROFILE"
        badge={selectedAsset ? getAssetTypeLabel(selectedAsset) : "NONE"}
      >
        {selectedAsset ? (
          <Section rows={buildStructuralRows(selectedAsset)} footer="CADENCE: QUARTERLY" />
        ) : (
          <Placeholder text="SELECT AN ASSET FROM THE MAP OR GRID." />
        )}
      </Panel>

      <Panel
        title="OBSERVED SIGNALS"
        badge={
          firmsSnapshot
            ? `${formatClassificationLabel(firmsSnapshot.classification)} ${formatCadenceLabel(firmsSnapshot.cadence)}`
            : "NO DATA"
        }
      >
        {selectedAsset ? (
          <ObservedSignalsSection
            anomaly={matchedAnomaly}
            linkedOutages={linkedOutages}
          />
        ) : (
          <Placeholder text="SELECT AN ASSET TO SEE FIRMS AND OUTAGE SIGNALS." />
        )}
      </Panel>

      <Panel
        title="CURATED DEPENDENCY"
        badge={country ? country.code : "UNSCORED"}
      >
        {selectedAsset ? (
          <CuratedDependencySection
            asset={selectedAsset}
            country={country}
            countryExposure={countryExposure}
            exposureEntry={exposureEntry}
          />
        ) : (
          <Placeholder text="SELECT AN ASSET TO SEE ROUTE AND CHOKEPOINT DEPENDENCY." />
        )}
      </Panel>

      <Panel
        title="MODELED EXPOSURE"
        badge={exposureBadge(exposureEntry)}
      >
        {selectedAsset ? (
          <ModeledExposureSection
            asset={selectedAsset}
            countriesByCode={countriesByCode}
            exposureEntry={exposureEntry}
          />
        ) : (
          <Placeholder text="SELECT AN ASSET TO SEE MODELED EXPOSURE." />
        )}
      </Panel>
    </div>
  );
}

function ObservedSignalsSection({
  anomaly,
  linkedOutages
}: {
  anomaly: FirmsSnapshot["anomalies"][number] | null;
  linkedOutages: OutageEventSnapshot["events"];
}) {
  if (!anomaly && linkedOutages.length === 0) {
    return <Placeholder text="NO OBSERVED SIGNALS IN WINDOW." />;
  }

  return (
    <div className={styles.section}>
      {anomaly ? (
        <>
          <div className={styles.primaryName}>FIRMS ANOMALY</div>
          <div className={styles.rows}>
            <Row label="Severity" value={anomaly.severity} />
            <Row label="Window count" value={String(anomaly.windowCount)} />
            <Row label="Latest detection" value={anomaly.latestDetectionAt} />
          </div>
        </>
      ) : null}

      {linkedOutages.length > 0 ? (
        <>
          <div className={styles.primaryName}>LINKED OUTAGES</div>
          <div className={styles.rows}>
            {linkedOutages.slice(0, 3).map((event) => (
              <Row
                key={event.id}
                label={event.date}
                value={`${event.name} (${event.severity})`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CuratedDependencySection({
  asset,
  country,
  countryExposure,
  exposureEntry
}: {
  asset: InfrastructureAsset;
  country: CountryProfile | null;
  countryExposure: ExposureRegistryEntry | null;
  exposureEntry: ExposureRegistryEntry | null;
}) {
  const rows = [
    {
      label: "Country dependency",
      value: country?.chokepointDependency ?? "UNSCORED"
    },
    {
      label: "Primary chokepoint",
      value: readExposureValue(exposureEntry, "primaryChokepointLabel")
    },
    {
      label: "Export route",
      value: readExposureValue(exposureEntry, "exportRoute")
    },
    {
      label: "Bypass capacity",
      value:
        typeof countryExposure?.targetKind === "string" &&
        countryExposure.targetKind === "country" &&
        typeof countryExposure.bypassCapacityMbpd === "number"
          ? `${countryExposure.bypassCapacityMbpd.toFixed(1)} MBPD`
          : "UNSCORED"
    }
  ];

  if (asset.assetKind === "refinery") {
    rows.push({
      label: "Dependency score",
      value:
        typeof asset.hormuzDependency === "number"
          ? `${Math.round(asset.hormuzDependency * 100)}%`
          : "UNSCORED"
    });
  }

  return <Section rows={rows} />;
}

function ModeledExposureSection({
  asset,
  countriesByCode,
  exposureEntry
}: {
  asset: InfrastructureAsset;
  countriesByCode: Record<string, CountryProfile>;
  exposureEntry: ExposureRegistryEntry | null;
}) {
  if (!exposureEntry) {
    return <Placeholder text="UNSCORED. NO CURATED EXPOSURE ENTRY." />;
  }

  if (exposureEntry.targetKind === "chokepoint") {
    const countryNames = exposureEntry.affectedCountryCodes
      .map((code) => countriesByCode[code]?.name ?? code)
      .join(" · ");

    return (
      <Section
        rows={[
          {
            label: "Baseline transit",
            value: `${exposureEntry.baselineTransitMbpd.toFixed(1)} MBPD`
          },
          {
            label: "Bypass capacity",
            value:
              typeof exposureEntry.bypassCapacityMbpd === "number"
                ? `${exposureEntry.bypassCapacityMbpd.toFixed(1)} MBPD`
                : "UNSCORED"
          },
          {
            label: "Modeled at-risk",
            value:
              typeof exposureEntry.modeledAtRiskMbpd === "number"
                ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
                : "UNSCORED"
          },
          {
            label: "Affected countries",
            value: countryNames || "UNSCORED"
          },
          {
            label: "Export systems",
            value: exposureEntry.exportSystems.join(" · ") || "UNSCORED"
          }
        ]}
      />
    );
  }

  if (exposureEntry.targetKind === "asset") {
    return (
      <Section
        rows={[
          {
            label: "Modeled at-risk",
            value:
              typeof exposureEntry.modeledAtRiskMbpd === "number"
                ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
                : "UNSCORED"
          },
          {
            label: "Dependency score",
            value:
              typeof exposureEntry.dependencyScore === "number"
                ? `${Math.round(exposureEntry.dependencyScore * 100)}%`
                : "UNSCORED"
          },
          {
            label: "Benchmarks",
            value: exposureEntry.relevantBenchmarks?.join(" · ") ?? "UNSCORED"
          },
          {
            label: "Primary chokepoint",
            value: exposureEntry.primaryChokepointLabel ?? "UNSCORED"
          }
        ]}
        footer={exposureEntry.note}
      />
    );
  }

  return (
    <Section
      rows={[
        {
          label: "Modeled at-risk",
          value:
            typeof exposureEntry.modeledAtRiskMbpd === "number"
              ? `~${exposureEntry.modeledAtRiskMbpd.toFixed(1)} MBPD`
              : "UNSCORED"
        },
        {
          label: "Seaborne exports",
          value:
            typeof exposureEntry.seaborneExportsMbpd === "number"
              ? `${exposureEntry.seaborneExportsMbpd.toFixed(1)} MBPD`
              : "UNSCORED"
        },
        {
          label: "Primary chokepoint",
          value: exposureEntry.primaryChokepointLabel ?? "UNSCORED"
        }
      ]}
      footer={exposureEntry.note}
    />
  );
}

function Section({
  rows,
  footer
}: {
  rows: Array<{ label: string; value: string }>;
  footer?: string;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.rows}>
        {rows.map((row) => (
          <Row key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
        ))}
      </div>
      {footer ? <div className={styles.attribution}>{footer}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className={styles.placeholder}>{text}</div>;
}

function buildStructuralRows(asset: InfrastructureAsset) {
  if (asset.assetKind === "refinery") {
    return [
      { label: "Name", value: asset.name },
      { label: "Country", value: asset.countryName },
      { label: "Status", value: formatStatusLabel(asset.status).toUpperCase() },
      { label: "Capacity", value: asset.capacity_bpd ? formatCapacity(asset.capacity_bpd) : "--" },
      { label: "Operator", value: asset.operator || "--" },
      { label: "Source", value: asset._metadata.source }
    ];
  }

  if (asset.assetKind === "pipeline") {
    return [
      { label: "Name", value: asset.name },
      { label: "Status", value: formatStatusLabel(asset.status).toUpperCase() },
      { label: "Hydrocarbon", value: asset.hydrocarbon.replaceAll("_", " ").toUpperCase() },
      { label: "Capacity", value: asset.capacity_boed ? formatCapacity(asset.capacity_boed).replace("bpd", "BOE/D") : "--" },
      { label: "Length", value: asset.length_km ? formatLengthKm(asset.length_km) : "--" },
      { label: "Source", value: asset._metadata.source }
    ];
  }

  if (asset.assetKind === "terminal") {
    return [
      { label: "Name", value: asset.name },
      { label: "Role", value: asset.terminalRole ?? asset.terminalType ?? "--" },
      { label: "Capacity", value: asset.capacity_mtpa ? formatMtpa(asset.capacity_mtpa) : asset.capacity_bpd ? formatCapacity(asset.capacity_bpd) : "--" },
      { label: "Operator", value: asset.operator ?? "--" },
      { label: "Source", value: asset._metadata.source }
    ];
  }

  if (asset.assetKind === "chokepoint") {
    return [
      { label: "Name", value: asset.name },
      { label: "Transit", value: formatTransitVolume(asset.transitVolume_mbpd) },
      {
        label: "Benchmarks",
        value: asset.linkedContext?.benchmarkRefs?.join(" · ") ?? "--"
      },
      { label: "Source", value: asset._metadata.source }
    ];
  }

  return [
    { label: "Name", value: asset.name },
    { label: "Country", value: asset.countryName },
    { label: "Type", value: asset.fieldType ?? "--" },
    { label: "Production", value: asset.production_bpd ? formatCapacity(asset.production_bpd) : "--" },
    { label: "Source", value: asset._metadata.source }
  ];
}

function exposureBadge(entry: ExposureRegistryEntry | null): string {
  if (!entry) {
    return "UNSCORED";
  }

  if (
    "modeledAtRiskMbpd" in entry &&
    typeof entry.modeledAtRiskMbpd === "number"
  ) {
    return `~${entry.modeledAtRiskMbpd.toFixed(1)} MBPD`;
  }

  return "MODELED";
}

function readExposureValue<T extends string>(
  entry: ExposureRegistryEntry | null,
  key: T
): string {
  if (!entry || !(key in entry)) {
    return "UNSCORED";
  }

  const value = entry[key as keyof ExposureRegistryEntry];
  return typeof value === "string" && value.length > 0 ? value : "UNSCORED";
}
