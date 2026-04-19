import type { Ref } from "react";
import styles from "./TopNav.module.css";
import { VIEW_REGISTRY, type ViewMode } from "../../types/View";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import { getAssetTypeLabel } from "../../utils/infrastructure";

interface TopNavProps {
  activeView: ViewMode;
  isScenarioActive: boolean;
  scenarioDisruptionPct: number;
  onChangeView: (view: ViewMode) => void;
  onCommandSubmit: (query: string) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectSearchResult: (asset: InfrastructureAsset) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  searchQuery: string;
  searchResults: InfrastructureAsset[];
  /** Current local + UTC clock pair — ticks every second in the parent. */
  localTime: string;
  utcTime: string;
  sessionDate: string;
}

/**
 * Primary navigation strip across the top of the terminal. Shape
 * mirrors the Bloomberg-tab pattern requested by the design brief:
 *
 *   [ATLAS]  [MIDDLE EAST]  |  [tab1 tab2 ... tabN]  [search]  [clocks]
 *
 * All tab changes pass through `onChangeView`; the parent is
 * responsible for logging the navigation into the activity log so
 * silent navigation doesn't break the CLAUDE.md UX principle #6
 * "every action leaves a trace."
 */
export function TopNav({
  activeView,
  isScenarioActive,
  scenarioDisruptionPct,
  onChangeView,
  onCommandSubmit,
  onSearchQueryChange,
  onSelectSearchResult,
  searchInputRef,
  searchQuery,
  searchResults,
  localTime,
  utcTime,
  sessionDate
}: TopNavProps) {
  return (
    <div className={styles.topNav}>
      <div className={styles.brandBlock}>
        <span className={styles.brand}>ATLAS</span>
        <span className={styles.domainTag}>GEOPOL · ENERGY</span>
      </div>

      <nav aria-label="Primary" className={styles.tabs}>
        {VIEW_REGISTRY.map((descriptor) => (
          <button
            aria-current={descriptor.id === activeView ? "page" : undefined}
            className={descriptor.id === activeView ? styles.tabActive : styles.tab}
            key={descriptor.id}
            onClick={() => onChangeView(descriptor.id)}
            type="button"
          >
            {descriptor.label}
          </button>
        ))}
      </nav>

      <form
        className={styles.searchRegion}
        onSubmit={(event) => {
          event.preventDefault();
          onCommandSubmit(searchQuery);
        }}
      >
        <span aria-hidden="true" className={styles.searchPrompt}>&gt;</span>
        <input
          aria-label="Command or search"
          autoComplete="off"
          className={styles.searchInput}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="SEARCH ASSET, REGION, EVENT"
          ref={searchInputRef}
          type="search"
          value={searchQuery}
        />
        <span className={styles.searchHint}>⌘K</span>
        {searchQuery.trim() ? (
          <div className={styles.searchResults}>
            {searchResults.length > 0 ? (
              searchResults.map((asset) => (
                <button
                  className={styles.searchResult}
                  key={asset.id}
                  onClick={() => onSelectSearchResult(asset)}
                  type="button"
                >
                  <span className={styles.resultName}>{asset.name}</span>
                  <span className={styles.resultMeta}>{buildSearchMeta(asset)}</span>
                </button>
              ))
            ) : (
              <div className={styles.emptySearchState}>NO MATCHES</div>
            )}
          </div>
        ) : null}
      </form>

      <div className={styles.clockBlock}>
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>LDN</span>
          <span className={styles.clockValue}>{localTime}</span>
        </span>
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>UTC</span>
          <span className={styles.clockValue}>{utcTime}</span>
        </span>
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>SESSION</span>
          <span className={styles.sessionOpen}>● OPEN</span>
        </span>
        <span className={styles.sessionDate}>{sessionDate}</span>
      </div>

      {isScenarioActive ? (
        <div
          aria-live="polite"
          className={styles.scenarioBadge}
          role="status"
        >
          <span className={styles.scenarioDot} />
          SCENARIO · HORMUZ {scenarioDisruptionPct.toFixed(0)}%
        </div>
      ) : null}
    </div>
  );
}

function buildSearchMeta(asset: InfrastructureAsset) {
  const typeLabel = getAssetTypeLabel(asset);
  const context = getSearchContext(asset);

  return [asset.country, typeLabel, context].filter(Boolean).join(" | ");
}

function getSearchContext(asset: InfrastructureAsset) {
  if (asset.assetKind === "refinery") {
    return asset.operator;
  }

  if (asset.assetKind === "pipeline") {
    return asset.owner;
  }

  if (asset.assetKind === "terminal") {
    return asset.operator ?? asset.owner ?? "";
  }

  return asset.countryName;
}
