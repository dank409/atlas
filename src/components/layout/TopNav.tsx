import { useState } from "react";
import styles from "./TopNav.module.css";
import { VIEW_REGISTRY, type ViewMode } from "../../types/View";
import type { SearchResult } from "../../utils/search";

interface TopNavProps {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  searchQuery: string;
  searchResults: SearchResult[];
}

export function TopNav({
  activeView,
  onChangeView,
  onSearchQueryChange,
  onSelectSearchResult,
  searchQuery,
  searchResults
}: TopNavProps) {
  // Which result Enter will open; the arrow keys move it.
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const activeIndex = Math.min(highlightedIndex, searchResults.length - 1);

  return (
    <div className={styles.topNav}>
      <div className={styles.brand}>ATLAS</div>

      <nav aria-label="Primary" className={styles.tabs}>
        {VIEW_REGISTRY.map((view) => (
          <button
            aria-current={view.id === activeView ? "page" : undefined}
            className={view.id === activeView ? styles.tabActive : styles.tab}
            key={view.id}
            onClick={() => onChangeView(view.id)}
            type="button"
          >
            {view.label}
          </button>
        ))}
      </nav>

      <form
        className={styles.searchRegion}
        onSubmit={(event) => {
          event.preventDefault();

          if (searchResults.length > 0) {
            onSelectSearchResult(searchResults[activeIndex]);
          }
        }}
        role="search"
      >
        <span aria-hidden="true" className={styles.searchPrompt}>
          &gt;
        </span>
        <input
          aria-label="Search the map and reference"
          autoComplete="off"
          className={styles.searchInput}
          onChange={(event) => {
            setHighlightedIndex(0);
            onSearchQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onSearchQueryChange("");
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              // Keep the caret where it is; the keys move through the results instead.
              event.preventDefault();
              setHighlightedIndex(
                Math.max(0, Math.min(searchResults.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1)))
              );
            }
          }}
          placeholder="SEARCH ASSETS, COUNTRIES, OPERATORS, GRADES"
          type="search"
          value={searchQuery}
        />
        {searchQuery.trim() ? (
          <div className={styles.searchResults}>
            {searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <button
                  className={index === activeIndex ? styles.searchResultActive : styles.searchResult}
                  key={result.key}
                  onClick={() => onSelectSearchResult(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  type="button"
                >
                  <span className={styles.resultName}>{result.name}</span>
                  <span className={styles.resultMeta}>{result.meta}</span>
                </button>
              ))
            ) : (
              <div className={styles.emptySearchState}>NO MATCHES</div>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}
