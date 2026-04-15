import styles from "./MapLoadingFallback.module.css";

// Suspense fallback for the lazy-loaded map workspace chunk.
// Intentionally spartan: true-black field, amber monospace label, zero
// radius, 1px border, no spinner. CLAUDE.md Critical UX Principle #4
// prohibits decorative spinners ("Don't animate what doesn't move"),
// and the map chunk usually lands in under a second on a warm cache so
// anything fancier would outlive its welcome.

export function MapLoadingFallback() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading map engine"
      className={styles.shell}
      role="status"
    >
      <span className={styles.label}>LOADING MAP ENGINE…</span>
    </div>
  );
}
