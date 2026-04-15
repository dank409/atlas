import { useEffect, useState, type Ref } from "react";
import styles from "./HeaderBar.module.css";
import { ViewMode } from "../../types/View";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import { getAssetTypeLabel } from "../../utils/infrastructure";

interface HeaderBarProps {
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
}

export function HeaderBar({
  activeView,
  isScenarioActive,
  scenarioDisruptionPct,
  onChangeView,
  onCommandSubmit,
  onSearchQueryChange,
  onSelectSearchResult,
  searchInputRef,
  searchQuery,
  searchResults
}: HeaderBarProps) {
  const time = useTickingClock();

  return (
    <div className={styles.headerBar}>
      <div className={styles.brand}>ATLAS</div>
      <div className={styles.separator}>|</div>
      <div className={styles.region}>MIDDLE EAST</div>
      <div className={styles.separator}>|</div>
      <form
        className={styles.searchRegion}
        onSubmit={(event) => {
          event.preventDefault();
          onCommandSubmit(searchQuery);
        }}
      >
        <label
          className={styles.searchLabel}
          htmlFor="terminal-search"
        >
          COMMAND
        </label>
        <div className={styles.searchBox}>
          <input
            autoComplete="off"
            className={styles.searchInput}
            id="terminal-search"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="TYPE COMMAND OR SEARCH"
            ref={searchInputRef}
            type="search"
            value={searchQuery}
          />
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
        </div>
      </form>
      <div className={styles.separator}>|</div>
      <div className={styles.tabGroup}>
        <button
          className={activeView === "map" ? styles.activeTab : styles.tab}
          onClick={() => onChangeView("map")}
          type="button"
        >
          MAP
        </button>
        <button
          className={activeView === "table" ? styles.activeTab : styles.tab}
          onClick={() => onChangeView("table")}
          type="button"
        >
          TABLE
        </button>
        <button
          className={activeView === "dash" ? styles.activeTab : styles.tab}
          onClick={() => onChangeView("dash")}
          type="button"
        >
          DASH
        </button>
        <button
          className={activeView === "grades" ? styles.activeTab : styles.tab}
          onClick={() => onChangeView("grades")}
          type="button"
        >
          GRADES
        </button>
      </div>
      {isScenarioActive ? (
        <div
          aria-live="polite"
          className={styles.scenarioBadge}
          role="status"
        >
          <span className={styles.scenarioDot} />
          SCENARIO MODE: ACTIVE · HORMUZ {scenarioDisruptionPct.toFixed(0)}%
        </div>
      ) : null}
      <div className={styles.clock}>{time}</div>
    </div>
  );
}

// Bloomberg terminals pulse the clock every second — a frozen clock was the
// fastest way to fail the "is this real" test, so we tick on an interval
// rather than relying on render-time `new Date()`.
function useTickingClock() {
  const [now, setNow] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(formatClock(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return now;
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date);
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
