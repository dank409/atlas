import { useMemo, useState } from "react";
import { CrudeGradeTable } from "../components/tables/CrudeGradeTable";
import type { UseCrudeGradesResult } from "../hooks/useCrudeGrades";
import type { DatasetId, InfrastructureAsset } from "../types/Infrastructure";
import type { NavigateReference, ReferenceLocation, ReferenceTab } from "../types/View";
import { formatDailyVolume, formatLengthKm } from "../utils/formatters";
import { countByDataset } from "../utils/infrastructure";
import {
  findGradeCountry,
  findMentionedAssets,
  type CountryEntry,
  type OperatorEntry
} from "../utils/referenceIndex";
import { CountryDetail } from "./reference/CountryDetail";
import { GlossaryPanel } from "./reference/GlossaryPanel";
import { GradeDetail } from "./reference/GradeDetail";
import { OperatorDetail } from "./reference/OperatorDetail";
import { ReferenceTable, type ReferenceColumn } from "./reference/ReferenceTable";
import styles from "./ReferencePage.module.css";

interface ReferencePageProps {
  /** Every country on the map, with its assets. */
  countries: CountryEntry[];
  /** The crude grade table. Loaded by App, which also searches it. */
  crudeGrades: UseCrudeGradesResult;
  location: ReferenceLocation;
  onNavigate: NavigateReference;
  /** Open the TABLE view on one layer. */
  onOpenTable: (datasetId: DatasetId) => void;
  /** Select an asset and show it on the map. */
  onSelectAsset: (asset: InfrastructureAsset) => void;
  /** Open the map filtered to one country or one operator. */
  onShowOnMap: (filters: { countryCode?: string; operatorId?: string }) => void;
  /** Every operator named in the map data, with its assets. */
  operators: OperatorEntry[];
}

const TABS: { id: ReferenceTab; label: string }[] = [
  { id: "countries", label: "COUNTRIES" },
  { id: "operators", label: "OPERATORS" },
  { id: "grades", label: "CRUDE GRADES" },
  { id: "glossary", label: "GLOSSARY" }
];

// One line beside the tabs for the two that are computed from the map data.
const TAB_HINTS: Partial<Record<ReferenceTab, string>> = {
  countries: "COUNTS FROM THE MAP DATA",
  operators: "GROUPED BY NAME FROM THE MAP DATA"
};

const COUNTRY_COLUMNS: ReferenceColumn<CountryEntry>[] = [
  { getValue: (country) => country.name, header: "COUNTRY", id: "name" },
  { getValue: (country) => countByDataset(country.assets).refineries, header: "REFINERIES", id: "refineries", isNumeric: true },
  {
    format: (country) => (country.refiningCapacityBpd > 0 ? formatDailyVolume(country.refiningCapacityBpd) : "--"),
    getValue: (country) => country.refiningCapacityBpd,
    header: "REFINING CAPACITY",
    id: "refiningCapacity",
    isNumeric: true
  },
  { getValue: (country) => countByDataset(country.assets).pipelines, header: "PIPELINES", id: "pipelines", isNumeric: true },
  { getValue: (country) => countByDataset(country.assets).fields, header: "FIELDS", id: "fields", isNumeric: true },
  { getValue: (country) => countByDataset(country.assets).terminals, header: "LNG", id: "terminals", isNumeric: true }
];

const OPERATOR_COLUMNS: ReferenceColumn<OperatorEntry>[] = [
  { getValue: (operator) => operator.name, header: "OPERATOR", id: "name" },
  { getValue: (operator) => operator.assets.length, header: "ASSETS", id: "assets", isNumeric: true },
  {
    format: (operator) => (operator.refiningCapacityBpd > 0 ? formatDailyVolume(operator.refiningCapacityBpd) : "--"),
    getValue: (operator) => operator.refiningCapacityBpd,
    header: "REFINING CAPACITY",
    id: "refiningCapacity",
    isNumeric: true
  },
  {
    format: (operator) => (operator.pipelineLengthKm > 0 ? formatLengthKm(operator.pipelineLengthKm) : "--"),
    getValue: (operator) => operator.pipelineLengthKm,
    header: "PIPELINE LENGTH",
    id: "pipelineLength",
    isNumeric: true
  },
  { getValue: (operator) => operator.countryCodes.length, header: "COUNTRIES", id: "countries", isNumeric: true }
];

/**
 * REFERENCE view: countries, operators, crude grades and a glossary, each
 * a list on the left with the selected entry on the right. Countries and
 * operators are built from the map data. Entries link to each other and
 * to the map.
 */
export function ReferencePage({
  countries,
  crudeGrades,
  location,
  onNavigate,
  onOpenTable,
  onSelectAsset,
  onShowOnMap,
  operators
}: ReferencePageProps) {
  const [operatorFilter, setOperatorFilter] = useState("");
  const grades = useMemo(() => crudeGrades.snapshot?.grades ?? [], [crudeGrades.snapshot]);
  const countryNames = useMemo(() => countries.map((country) => country.name), [countries]);
  const countryNameByCode = useMemo(
    () => Object.fromEntries(countries.map((country) => [country.code, country.name])),
    [countries]
  );
  const filteredOperators = useMemo(() => {
    const query = operatorFilter.trim().toLowerCase();

    return query ? operators.filter((operator) => operator.name.toLowerCase().includes(query)) : operators;
  }, [operatorFilter, operators]);

  // Each list shows an entry from the start, so the detail side is never
  // blank: the first country, the operator with most assets, and the
  // lightest grade (the top row of the grade table's opening sort).
  const selectedCountry =
    countries.find((country) => country.code === location.selectedIdByTab.countries) ?? countries[0] ?? null;
  const selectedOperator =
    operators.find((operator) => operator.id === location.selectedIdByTab.operators) ?? operators[0] ?? null;
  const lightestGrade = grades.reduce<(typeof grades)[number] | null>(
    (lightest, grade) => (lightest && lightest.apiGravity >= grade.apiGravity ? lightest : grade),
    null
  );
  const selectedGrade = grades.find((grade) => grade.id === location.selectedIdByTab.grades) ?? lightestGrade;
  const selectedGradeCountry = selectedGrade ? findGradeCountry(selectedGrade, countries) : null;
  const tabHint = TAB_HINTS[location.tab];

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div aria-label="Reference sections" className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              aria-selected={tab.id === location.tab}
              className={tab.id === location.tab ? styles.tabActive : styles.tab}
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {tabHint ? <span className={styles.tabHint}>{tabHint}</span> : null}
      </div>

      <div className={styles.body}>
        {location.tab === "countries" ? (
          <div className={styles.split}>
            <div className={styles.listPane}>
              <ReferenceTable
                ariaLabel="Countries"
                columns={COUNTRY_COLUMNS}
                getRowId={(country) => country.code}
                initialSort={{ columnId: "name", isDescending: false }}
                onSelect={(code) => onNavigate("countries", code)}
                rows={countries}
                selectedId={selectedCountry?.code ?? null}
              />
            </div>
            <div className={styles.detailPane}>
              {selectedCountry ? (
                <CountryDetail
                  country={selectedCountry}
                  grades={grades.filter((grade) => findGradeCountry(grade, countries)?.code === selectedCountry.code)}
                  ignoredMentionNames={countryNames}
                  // Remount per country so "show all" toggles do not carry over.
                  key={selectedCountry.code}
                  onNavigate={onNavigate}
                  onSelectAsset={onSelectAsset}
                  onShowOnMap={() => onShowOnMap({ countryCode: selectedCountry.code })}
                  operators={selectedCountry.operatorIds.flatMap(
                    (id) => operators.find((operator) => operator.id === id) ?? []
                  )}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {location.tab === "operators" ? (
          <div className={styles.split}>
            <div className={styles.listPane}>
              <input
                aria-label="Filter operators"
                className={styles.filterInput}
                onChange={(event) => setOperatorFilter(event.target.value)}
                placeholder={`FILTER ${operators.length} OPERATORS BY NAME`}
                type="search"
                value={operatorFilter}
              />
              <ReferenceTable
                ariaLabel="Operators"
                columns={OPERATOR_COLUMNS}
                getRowId={(operator) => operator.id}
                initialSort={{ columnId: "assets", isDescending: true }}
                onSelect={(id) => onNavigate("operators", id)}
                rows={filteredOperators}
                selectedId={selectedOperator?.id ?? null}
              />
            </div>
            <div className={styles.detailPane}>
              {selectedOperator ? (
                <OperatorDetail
                  countryNameByCode={countryNameByCode}
                  key={selectedOperator.id}
                  onNavigate={onNavigate}
                  onSelectAsset={onSelectAsset}
                  onShowOnMap={() => onShowOnMap({ operatorId: selectedOperator.id })}
                  operator={selectedOperator}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {location.tab === "grades" ? (
          <div className={styles.split}>
            <div className={styles.listPane}>
              <CrudeGradeTable
                error={crudeGrades.error}
                isLoading={crudeGrades.isLoading}
                onInspectGrade={(grade) => onNavigate("grades", grade.id)}
                selectedGradeId={selectedGrade?.id}
                snapshot={crudeGrades.snapshot}
              />
            </div>
            <div className={styles.detailPane}>
              {selectedGrade ? (
                <GradeDetail
                  countryCode={selectedGradeCountry?.code ?? null}
                  grade={selectedGrade}
                  key={selectedGrade.id}
                  mentionedAssets={findMentionedAssets(
                    `${selectedGrade.name}. ${selectedGrade.note}`,
                    selectedGradeCountry?.assets ?? [],
                    countryNames
                  )}
                  onNavigate={onNavigate}
                  onSelectAsset={onSelectAsset}
                  siblingGrades={grades.filter(
                    (grade) => grade.producer === selectedGrade.producer && grade.id !== selectedGrade.id
                  )}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {location.tab === "glossary" ? (
          <GlossaryPanel
            highlightedTerm={location.selectedIdByTab.glossary}
            onNavigate={onNavigate}
            onOpenTable={onOpenTable}
          />
        ) : null}
      </div>
    </div>
  );
}
