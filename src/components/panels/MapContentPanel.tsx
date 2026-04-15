import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Panel } from "../common/Panel";
import {
  buildDatasetOptions,
  getLegendItems
} from "../../utils/infrastructure";
import type {
  DatasetCatalogEntry,
  DatasetFiltersById,
  DatasetId,
  InfrastructureAsset
} from "../../types/Infrastructure";
import styles from "./MapContentPanel.module.css";

interface MapContentPanelProps {
  activeDatasetIds: DatasetId[];
  assets: InfrastructureAsset[];
  filtersByDataset: DatasetFiltersById;
  focusedDataset: DatasetCatalogEntry | null;
  onFilterChange: (datasetId: DatasetId, field: string, value: string) => void;
  onToggleDataset: (datasetId: DatasetId) => void;
}

export function MapContentPanel({
  activeDatasetIds,
  assets,
  filtersByDataset,
  focusedDataset,
  onFilterChange,
  onToggleDataset
}: MapContentPanelProps) {
  if (!focusedDataset) {
    return (
      <Panel title="MAP CONTENT">
        <div className={styles.placeholder}>NO DATASET FOCUSED.</div>
      </Panel>
    );
  }

  const isActive = activeDatasetIds.includes(focusedDataset.id);
  const datasetAssets = assets.filter((asset) => asset.datasetId === focusedDataset.id);
  const source = datasetAssets[0]?._metadata.source ?? focusedDataset.source;
  const updated = datasetAssets[0]?._metadata.downloadDate ?? "--";
  const legendItems = getLegendItems(focusedDataset.id);

  return (
    <Panel
      title="MAP CONTENT"
      badge={focusedDataset.title}
    >
      <div className={styles.datasetHeader}>
        <div>
          <div className={styles.datasetTitle}>{focusedDataset.title}</div>
          <div className={styles.datasetMeta}>SOURCE: {source}</div>
          <div className={styles.datasetMeta}>UPDATED: {updated}</div>
        </div>
        <button
          className={isActive ? styles.toggleButtonActive : styles.toggleButton}
          disabled={focusedDataset.status !== "available"}
          onClick={() => onToggleDataset(focusedDataset.id)}
          type="button"
        >
          {isActive ? "VISIBLE" : "HIDDEN"}
        </button>
      </div>

      <div className={styles.datasetSummary}>
        <span>{focusedDataset.coverage}</span>
        <span className={styles.separator}>|</span>
        <span>{focusedDataset.frequency}</span>
        <span className={styles.separator}>|</span>
        <span>{focusedDataset.recordCount} RECORDS</span>
      </div>

      <div className={styles.note}>{focusedDataset.notes}</div>

      {renderFilters({ assets, datasetId: focusedDataset.id, filtersByDataset, onFilterChange })}

      {legendItems.length > 0 ? (
        <div className={styles.legendSection}>
          <div className={styles.sectionLabel}>LEGEND</div>
          <div className={styles.legendList}>
            {legendItems.map((item) => (
              <div
                className={styles.legendItem}
                key={`${focusedDataset.id}-${item.label}`}
              >
                <span
                  className={styles.legendSwatch}
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

interface FilterRendererProps {
  assets: InfrastructureAsset[];
  datasetId: DatasetId;
  filtersByDataset: DatasetFiltersById;
  onFilterChange: (datasetId: DatasetId, field: string, value: string) => void;
}

interface FilterOption {
  label: string;
  value: string;
}

function renderFilters({ assets, datasetId, filtersByDataset, onFilterChange }: FilterRendererProps) {
  const commonCountryOptions = buildCountryFilterOptions(assets, datasetId);
  const commonStatusOptions = buildSelectOptions(buildDatasetOptions(assets, datasetId, "status"));

  if (datasetId === "refineries") {
    const filters = filtersByDataset.refineries;

    return (
      <div className={styles.filtersSection}>
        <div className={styles.sectionLabel}>FILTERS</div>
        <div className={styles.filterGrid}>
          <FilterInput
            id="refineries-text-filter"
            label="Text filter"
            onChange={(value) => onFilterChange("refineries", "text", value)}
            value={filters.text}
          />
          <FilterSelect
            id="refineries-country-filter"
            label="Country filter"
            onChange={(value) => onFilterChange("refineries", "country", value)}
            options={commonCountryOptions}
            value={filters.country}
          />
          <FilterSelect
            id="refineries-operator-filter"
            label="Operator filter"
            onChange={(value) => onFilterChange("refineries", "operator", value)}
            options={buildSelectOptions(buildDatasetOptions(assets, "refineries", "operator"))}
            value={filters.operator}
          />
          <FilterSelect
            id="refineries-status-filter"
            label="Status filter"
            onChange={(value) => onFilterChange("refineries", "status", value)}
            options={commonStatusOptions}
            value={filters.status}
          />
        </div>
      </div>
    );
  }

  if (datasetId === "pipelines") {
    const filters = filtersByDataset.pipelines;

    return (
      <div className={styles.filtersSection}>
        <div className={styles.sectionLabel}>FILTERS</div>
        <div className={styles.filterGrid}>
          <FilterInput
            id="pipelines-text-filter"
            label="Text filter"
            onChange={(value) => onFilterChange("pipelines", "text", value)}
            value={filters.text}
          />
          <FilterSelect
            id="pipelines-country-filter"
            label="Country filter"
            onChange={(value) => onFilterChange("pipelines", "country", value)}
            options={commonCountryOptions}
            value={filters.country}
          />
          <FilterSelect
            id="pipelines-hydrocarbon-filter"
            label="Hydrocarbon filter"
            onChange={(value) => onFilterChange("pipelines", "hydrocarbon", value)}
            options={buildSelectOptions(buildDatasetOptions(assets, "pipelines", "hydrocarbon"))}
            value={filters.hydrocarbon}
          />
          <FilterSelect
            id="pipelines-status-filter"
            label="Status filter"
            onChange={(value) => onFilterChange("pipelines", "status", value)}
            options={commonStatusOptions}
            value={filters.status}
          />
        </div>
      </div>
    );
  }

  if (datasetId === "chokepoints") {
    const filters = filtersByDataset.chokepoints;

    return (
      <div className={styles.filtersSection}>
        <div className={styles.sectionLabel}>FILTERS</div>
        <div className={styles.filterGrid}>
          <FilterInput
            id="chokepoints-text-filter"
            label="Text filter"
            onChange={(value) => onFilterChange("chokepoints", "text", value)}
            value={filters.text}
          />
          <FilterSelect
            id="chokepoints-country-filter"
            label="Country filter"
            onChange={(value) => onFilterChange("chokepoints", "country", value)}
            options={commonCountryOptions}
            value={filters.country}
          />
          <FilterSelect
            id="chokepoints-status-filter"
            label="Status filter"
            onChange={(value) => onFilterChange("chokepoints", "status", value)}
            options={commonStatusOptions}
            value={filters.status}
          />
        </div>
      </div>
    );
  }

  if (datasetId === "fields") {
    const filters = filtersByDataset.fields;

    return (
      <div className={styles.filtersSection}>
        <div className={styles.sectionLabel}>FILTERS</div>
        <div className={styles.filterGrid}>
          <FilterInput
            id="fields-text-filter"
            label="Text filter"
            onChange={(value) => onFilterChange("fields", "text", value)}
            value={filters.text}
          />
          <FilterSelect
            id="fields-country-filter"
            label="Country filter"
            onChange={(value) => onFilterChange("fields", "country", value)}
            options={commonCountryOptions}
            value={filters.country}
          />
          <FilterSelect
            id="fields-status-filter"
            label="Status filter"
            onChange={(value) => onFilterChange("fields", "status", value)}
            options={commonStatusOptions}
            value={filters.status}
          />
        </div>
      </div>
    );
  }

  if (datasetId === "terminals") {
    const filters = filtersByDataset.terminals;

    return (
      <div className={styles.filtersSection}>
        <div className={styles.sectionLabel}>FILTERS</div>
        <div className={styles.filterGrid}>
          <FilterInput
            id="terminals-text-filter"
            label="Text filter"
            onChange={(value) => onFilterChange("terminals", "text", value)}
            value={filters.text}
          />
          <FilterSelect
            id="terminals-country-filter"
            label="Country filter"
            onChange={(value) => onFilterChange("terminals", "country", value)}
            options={commonCountryOptions}
            value={filters.country}
          />
          <FilterSelect
            id="terminals-status-filter"
            label="Status filter"
            onChange={(value) => onFilterChange("terminals", "status", value)}
            options={commonStatusOptions}
            value={filters.status}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.placeholder}>
      CURATED IMPORT PENDING. THIS DATASET IS RESERVED IN THE WORKSPACE SO THE CONTRACT STAYS STABLE.
    </div>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}

function FilterSelect({ id, label, onChange, options, value }: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const allOptions = useMemo(() => [{ label: "All", value: "ALL" }, ...options], [options]);
  const selectedOption = allOptions.find((option) => option.value === value) ?? allOptions[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className={styles.filterControl}
      ref={controlRef}
    >
      <span
        className={styles.filterLabel}
        id={`${id}-label`}
      >
        {label}
      </span>
      <button
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={isOpen ? styles.selectButtonOpen : styles.selectButton}
        id={id}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className={styles.selectButtonValue}>{selectedOption.label}</span>
        <span className={styles.selectChevron}>{isOpen ? "▴" : "▾"}</span>
      </button>
      {isOpen ? (
        <div className={styles.selectMenuShell}>
          <div
            aria-label={label}
            className={styles.selectMenu}
            id={listboxId}
            role="listbox"
          >
            {allOptions.map((option) => (
              <button
                aria-selected={option.value === value}
                className={option.value === value ? styles.selectOptionActive : styles.selectOption}
                key={`${id}-${option.value}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface FilterInputProps {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

function FilterInput({ id, label, onChange, value }: FilterInputProps) {
  return (
    <label
      className={styles.filterControl}
      htmlFor={id}
    >
      <span className={styles.filterLabel}>{label}</span>
      <input
        aria-label={label}
        className={styles.input}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder="SEARCH"
        type="search"
        value={value}
      />
    </label>
  );
}

function buildCountryFilterOptions(assets: InfrastructureAsset[], datasetId: DatasetId): FilterOption[] {
  const labelsByCountry = new Map<string, string>();

  assets
    .filter((asset) => asset.datasetId === datasetId)
    .forEach((asset) => {
      if (!labelsByCountry.has(asset.country)) {
        labelsByCountry.set(asset.country, asset.countryName);
      }
    });

  return Array.from(labelsByCountry.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ label, value }));
}

function buildSelectOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({
    label: formatFilterOptionLabel(value),
    value
  }));
}

function formatFilterOptionLabel(value: string) {
  if (value === "ALL") {
    return "All";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
