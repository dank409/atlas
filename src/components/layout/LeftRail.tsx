import type { DatasetCatalogEntry, DatasetId } from "../../types/Infrastructure";
import { ENERGY_COLORS, ENERGY_LABELS, ENERGY_TYPES, type EnergyType } from "../../utils/assetEnergy";
import { LARGEST_OPTIONS, NO_FILTERS, hasActiveFilters, type AssetFilters } from "../../utils/assetFilters";
import { FilterSelect, type FilterOption } from "../common/FilterSelect";
import styles from "./LeftRail.module.css";

interface LeftRailProps {
  activeDatasetIds: DatasetId[];
  activeEnergyTypes: EnergyType[];
  catalog: DatasetCatalogEntry[];
  /** Countries the country filter offers, each with its asset count. */
  countryOptions: FilterOption[];
  /** Assets per energy type and per layer that pass the filters. */
  energyCounts: Record<EnergyType, number>;
  filters: AssetFilters;
  layerCounts: Record<DatasetId, number>;
  /** Operators the operator filter offers, most assets first. */
  operatorOptions: FilterOption[];
  onChangeFilters: (filters: AssetFilters) => void;
  onToggleDataset: (datasetId: DatasetId) => void;
  onToggleEnergyType: (energyType: EnergyType) => void;
  onToggleUnmappedRoutes: () => void;
  /** Whether the map draws pipeline stretches that have no mapped route. */
  showUnmappedRoutes: boolean;
}

type GlyphShape = "diamond" | "triangle" | "triangleDown" | "dot" | "line" | "dashedLine";

const GLYPH_BY_DATASET: Record<DatasetId, GlyphShape> = {
  fields: "dot",
  pipelines: "line",
  refineries: "diamond",
  terminals: "triangle"
};

/**
 * Controls for the map and table, and the key to reading them. Layers
 * choose what kind of asset is shown (marker shape); energy types choose
 * what it handles (marker colour); the filters narrow both to one country,
 * one operator, or the largest assets. Kept short enough to fit without
 * scrolling.
 */
export function LeftRail({
  activeDatasetIds,
  activeEnergyTypes,
  catalog,
  countryOptions,
  energyCounts,
  filters,
  layerCounts,
  onChangeFilters,
  onToggleDataset,
  onToggleEnergyType,
  onToggleUnmappedRoutes,
  operatorOptions,
  showUnmappedRoutes
}: LeftRailProps) {
  return (
    <div className={styles.rail}>
      <section className={styles.section}>
        <div className={styles.sectionLabel}>
          LAYERS <span className={styles.sectionHint}>MARKER SHAPE</span>
        </div>
        {catalog.map((dataset) => (
          <ToggleRow
            count={layerCounts[dataset.id]}
            isActive={activeDatasetIds.includes(dataset.id)}
            key={dataset.id}
            label={dataset.title}
            onToggle={() => onToggleDataset(dataset.id)}
            swatch={<Glyph shape={GLYPH_BY_DATASET[dataset.id]} />}
          />
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>
          ENERGY TYPE <span className={styles.sectionHint}>MARKER COLOUR</span>
        </div>
        {ENERGY_TYPES.map((energyType) => (
          <ToggleRow
            count={energyCounts[energyType]}
            isActive={activeEnergyTypes.includes(energyType)}
            key={energyType}
            label={ENERGY_LABELS[energyType].toUpperCase()}
            onToggle={() => onToggleEnergyType(energyType)}
            swatch={<span className={styles.colorSwatch} style={{ backgroundColor: ENERGY_COLORS[energyType] }} />}
          />
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>
          FILTER
          {hasActiveFilters(filters) ? (
            <button className={styles.resetButton} onClick={() => onChangeFilters(NO_FILTERS)} type="button">
              RESET
            </button>
          ) : null}
        </div>
        <div className={styles.filters}>
          <FilterSelect
            label="COUNTRY"
            onChange={(countryCode) => onChangeFilters({ ...filters, countryCode })}
            options={countryOptions}
            value={filters.countryCode}
          />
          <FilterSelect
            isSearchable
            label="OPERATOR"
            onChange={(operatorId) => onChangeFilters({ ...filters, operatorId })}
            options={operatorOptions}
            value={filters.operatorId}
          />
          <FilterSelect
            label="LARGEST"
            onChange={(count) => onChangeFilters({ ...filters, largestPerLayer: count ? Number(count) : null })}
            options={LARGEST_OPTIONS.map((count) => ({ label: `${count} PER LAYER`, value: String(count) }))}
            value={filters.largestPerLayer === null ? null : String(filters.largestPerLayer)}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>MAP KEY</div>
        <ul className={styles.keyList}>
          <li>
            <span className={styles.keyGlyphs}>
              <Glyph shape="triangle" />
              <Glyph shape="triangleDown" />
            </span>
            LNG export / LNG import
          </li>
          <li>
            <span className={styles.keyGlyphs}>
              <Glyph shape="diamond" size={8} />
              <Glyph shape="diamond" />
            </span>
            Larger = more capacity
          </li>
          <li>
            <span className={styles.keyGlyphs}>
              <Glyph isFaded shape="line" />
            </span>
            Faded = not operating
          </li>
          <li className={styles.keyToggle}>
            <label className={styles.keyToggleLabel}>
              <input
                checked={showUnmappedRoutes}
                className={styles.checkbox}
                onChange={onToggleUnmappedRoutes}
                type="checkbox"
              />
              <Glyph shape="dashedLine" />
              <span className={showUnmappedRoutes ? styles.labelActive : styles.labelInactive}>
                Dashed = route not mapped
              </span>
            </label>
            <p className={styles.keyNote}>
              Only the two ends are known, so the line is straight.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}

function ToggleRow({
  count,
  isActive,
  label,
  onToggle,
  swatch
}: {
  count: number;
  isActive: boolean;
  label: string;
  onToggle: () => void;
  swatch: React.ReactNode;
}) {
  return (
    <label className={styles.toggleRow}>
      <input checked={isActive} className={styles.checkbox} onChange={onToggle} type="checkbox" />
      <span aria-hidden="true" className={styles.swatchCell}>
        {swatch}
      </span>
      <span className={isActive ? styles.labelActive : styles.labelInactive}>{label}</span>
      <span className={styles.count}>{count}</span>
    </label>
  );
}

// Small pictures of the map markers. Neutral grey: shape is what they show.
function Glyph({ isFaded = false, shape, size = 12 }: { isFaded?: boolean; shape: GlyphShape; size?: number }) {
  const className = isFaded ? styles.glyphFaded : styles.glyph;

  return (
    <svg aria-hidden="true" className={className} height={size} viewBox="0 0 12 12" width={size}>
      {shape === "diamond" ? <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" /> : null}
      {shape === "triangle" ? <polygon points="6,1 11.5,11 0.5,11" /> : null}
      {shape === "triangleDown" ? <polygon points="6,11 11.5,1 0.5,1" /> : null}
      {shape === "dot" ? <circle cx="6" cy="6" r="3" /> : null}
      {shape === "line" ? <rect height="2" width="12" x="0" y="5" /> : null}
      {shape === "dashedLine" ? (
        <>
          <rect height="2" width="3" x="0" y="5" />
          <rect height="2" width="3" x="4.5" y="5" />
          <rect height="2" width="3" x="9" y="5" />
        </>
      ) : null}
    </svg>
  );
}
