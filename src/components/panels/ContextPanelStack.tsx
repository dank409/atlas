import { Panel } from "../common/Panel";
import {
  formatCapacity,
  formatLengthKm,
  formatMtpa,
  formatStatusLabel,
  formatTransitVolume
} from "../../utils/formatters";
import { getAssetTypeLabel } from "../../utils/infrastructure";
import type {
  CompanyProfile,
  CountryProfile,
  InfrastructureAsset
} from "../../types/Infrastructure";
import styles from "./ContextPanelStack.module.css";

interface ContextPanelStackProps {
  companiesById: Record<string, CompanyProfile>;
  countriesByCode: Record<string, CountryProfile>;
  /**
   * Click-to-expand drill-down handlers. Mirror the same pattern the
   * asset/grade/dashboard tables use: when provided, the OPERATOR
   * and COUNTRY context sections become clickable cards that open
   * full-screen overlays. Omitted → the sections render inert, so
   * the component stays renderable in isolation (ContextPanelStack
   * unit tests do not provide these props).
   */
  onInspectCompany?: (company: CompanyProfile) => void;
  onInspectCountry?: (country: CountryProfile) => void;
  selectedAsset: InfrastructureAsset | null;
}

export function ContextPanelStack({
  companiesById,
  countriesByCode,
  onInspectCompany,
  onInspectCountry,
  selectedAsset
}: ContextPanelStackProps) {
  const company = selectedAsset?.linkedContext?.companyId
    ? companiesById[selectedAsset.linkedContext.companyId] ?? null
    : null;
  const countryCode = selectedAsset?.linkedContext?.countryCode ?? selectedAsset?.country;
  const country = countryCode ? countriesByCode[countryCode] ?? null : null;

  // Covered-country list is derived live from the profile registry so that
  // authoring a new country JSON entry automatically updates this placeholder
  // — no hardcoded list to drift.
  const coveredCountryNames = Object.values(countriesByCode)
    .map((entry) => entry.name.toUpperCase())
    .sort((a, b) => a.localeCompare(b));

  const isOperatorUnmapped = Boolean(selectedAsset) && !company;
  const isCountryUnmapped = Boolean(selectedAsset) && !country;

  return (
    <div className={styles.stack}>
      <Panel
        title="ASSET DETAIL"
        badge={selectedAsset ? getAssetTypeLabel(selectedAsset) : "NONE"}
      >
        {selectedAsset ? <AssetDetail asset={selectedAsset} /> : <Placeholder text="SELECT AN ASSET FROM THE MAP OR GRID." />}
      </Panel>
      <Panel
        title="OPERATOR CONTEXT"
        badge={isOperatorUnmapped ? "COMING SOON" : company && onInspectCompany ? "EXPAND ▸" : undefined}
      >
        {company ? (
          <CompanyContext company={company} onInspect={onInspectCompany} />
        ) : selectedAsset ? (
          <UnmappedOperatorNotice asset={selectedAsset} />
        ) : (
          <Placeholder text="SELECT AN ASSET TO SEE OPERATOR CONTEXT." />
        )}
      </Panel>
      <Panel
        title="COUNTRY CONTEXT"
        badge={isCountryUnmapped ? "COMING SOON" : country && onInspectCountry ? "EXPAND ▸" : undefined}
      >
        {country ? (
          <CountryContext country={country} onInspect={onInspectCountry} />
        ) : selectedAsset ? (
          <UnmappedCountryNotice
            asset={selectedAsset}
            coveredCountryNames={coveredCountryNames}
          />
        ) : (
          <Placeholder text="SELECT AN ASSET TO SEE COUNTRY CONTEXT." />
        )}
      </Panel>
    </div>
  );
}

function UnmappedOperatorNotice({ asset }: { asset: InfrastructureAsset }) {
  const operatorLabel = "operator" in asset && asset.operator ? asset.operator : "--";

  return (
    <div className={styles.section}>
      <div className={styles.primaryName}>UNMAPPED OPERATOR</div>
      <div className={styles.paragraph}>
        Profile forthcoming. This operator is not yet in the curated company
        registry.
      </div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Country</span>
          <span className={styles.value}>{asset.countryName}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Last known operator</span>
          <span className={styles.value}>{operatorLabel}</span>
        </div>
      </div>
    </div>
  );
}

function UnmappedCountryNotice({
  asset,
  coveredCountryNames
}: {
  asset: InfrastructureAsset;
  coveredCountryNames: string[];
}) {
  const coverageLabel =
    coveredCountryNames.length > 0 ? coveredCountryNames.join(" · ") : "--";

  return (
    <div className={styles.section}>
      <div className={styles.primaryName}>UNMAPPED COUNTRY</div>
      <div className={styles.paragraph}>
        Profile forthcoming. Other Middle East countries ship in a future
        release.
      </div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Selected country</span>
          <span className={styles.value}>{asset.countryName}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Region coverage today</span>
          <span className={styles.value}>{coverageLabel}</span>
        </div>
      </div>
    </div>
  );
}

function AssetDetail({ asset }: { asset: InfrastructureAsset }) {
  return (
    <div className={styles.section}>
      <div className={styles.primaryName}>{asset.name}</div>
      <div className={styles.summaryLine}>
        {asset.countryName} | {formatStatusLabel(asset.status).toUpperCase()}
      </div>
      <div className={styles.rows}>
        {buildAssetRows(asset).map((row) => (
          <div
            className={styles.row}
            key={`${asset.id}-${row.label}`}
          >
            <span className={styles.label}>{row.label}</span>
            <span className={styles.value}>{row.value}</span>
          </div>
        ))}
      </div>
      <div className={styles.attribution}>SOURCE: {asset._metadata.source}</div>
      <div className={styles.attribution}>UPDATED: {asset._metadata.downloadDate}</div>
    </div>
  );
}

function CompanyContext({
  company,
  onInspect
}: {
  company: CompanyProfile;
  onInspect?: (company: CompanyProfile) => void;
}) {
  const body = (
    <>
      <div className={styles.primaryName}>{company.name}</div>
      <div className={styles.paragraph}>{company.summary}</div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Domicile</span>
          <span className={styles.value}>{company.domicile}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Website</span>
          <span className={styles.value}>{company.website}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Tickers</span>
          <span className={styles.value}>{company.tickers.join(" | ") || "--"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Benchmarks</span>
          <span className={styles.value}>{company.benchmarks.join(" | ") || "--"}</span>
        </div>
      </div>
      <div className={styles.attribution}>SOURCE: {company.source}</div>
      <div className={styles.attribution}>UPDATED: {company.updated}</div>
    </>
  );

  // When an inspect callback is provided, the entire section becomes
  // a clickable card (button element so keyboard + a11y come along
  // for free). Hover tints the primary name amber — same affordance
  // the asset grid and dashboard tables use.
  if (onInspect) {
    return (
      <button
        className={`${styles.section} ${styles.clickableSection}`}
        onClick={() => onInspect(company)}
        title={`Expand ${company.name} profile`}
        type="button"
      >
        {body}
      </button>
    );
  }

  return <div className={styles.section}>{body}</div>;
}

function CountryContext({
  country,
  onInspect
}: {
  country: CountryProfile;
  onInspect?: (country: CountryProfile) => void;
}) {
  const body = (
    <>
      <div className={styles.primaryName}>{country.name}</div>
      <div className={styles.paragraph}>{country.summary}</div>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Key grades</span>
          <span className={styles.value}>{country.keyGrades.join(" | ") || "--"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Chokepoint dependency</span>
          <span className={styles.value}>{country.chokepointDependency}</span>
        </div>
      </div>
      <div className={styles.attribution}>SOURCE: {country.source}</div>
      <div className={styles.attribution}>UPDATED: {country.updated}</div>
    </>
  );

  if (onInspect) {
    return (
      <button
        className={`${styles.section} ${styles.clickableSection}`}
        onClick={() => onInspect(country)}
        title={`Expand ${country.name} profile`}
        type="button"
      >
        {body}
      </button>
    );
  }

  return <div className={styles.section}>{body}</div>;
}

function Placeholder({ text }: { text: string }) {
  return <div className={styles.placeholder}>{text}</div>;
}

function buildAssetRows(asset: InfrastructureAsset) {
  if (asset.assetKind === "refinery") {
    return [
      { label: "Owner", value: asset.owner },
      { label: "Operator", value: asset.operator },
      { label: "Capacity", value: asset.capacity_bpd ? formatCapacity(asset.capacity_bpd) : "--" },
      { label: "Ticker", value: asset.linkedContext?.ticker ?? asset.ticker ?? "--" },
      { label: "FIRMS radius", value: `${asset.firmsRadius_km ?? "--"} km` }
    ];
  }

  if (asset.assetKind === "pipeline") {
    return [
      { label: "Owner", value: asset.owner },
      { label: "Operator", value: asset.operator ?? "--" },
      { label: "Hydrocarbon", value: asset.hydrocarbon.replaceAll("_", " ").toUpperCase() },
      { label: "Capacity", value: asset.capacity_boed ? formatCapacity(asset.capacity_boed).replace("bpd", "BOE/D") : "--" },
      { label: "Length", value: asset.length_km ? formatLengthKm(asset.length_km) : "--" },
      { label: "Ticker", value: asset.linkedContext?.ticker ?? asset.ticker ?? "--" }
    ];
  }

  if (asset.assetKind === "chokepoint") {
    return [
      { label: "Transit volume", value: formatTransitVolume(asset.transitVolume_mbpd) },
      {
        label: "Benchmarks",
        value: asset.linkedContext?.benchmarkRefs?.join(" | ") ?? "--"
      }
    ];
  }

  if (asset.assetKind === "terminal") {
    return [
      { label: "Owner", value: asset.owner ?? "--" },
      { label: "Operator", value: asset.operator ?? "--" },
      { label: "Terminal type", value: asset.terminalRole ?? asset.terminalType ?? "--" },
      { label: "Capacity", value: asset.capacity_mtpa ? formatMtpa(asset.capacity_mtpa) : asset.capacity_bpd ? formatCapacity(asset.capacity_bpd) : "--" }
    ];
  }

  return [
    { label: "Operator", value: asset.operator ?? "--" },
    { label: "Basin", value: asset.basin ?? "--" },
    { label: "Field type", value: asset.fieldType ?? "--" },
    { label: "Production", value: asset.production_bpd ? formatCapacity(asset.production_bpd) : "--" }
  ];
}
