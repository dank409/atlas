import styles from "./ShortcutOverlay.module.css";

const SHORTCUT_ROWS = [
  ["M", "MAP VIEW"],
  ["T", "TABLE VIEW"],
  ["D", "DASH VIEW"],
  ["G", "GRADES VIEW"],
  ["1", "TOGGLE REFINERIES"],
  ["2", "TOGGLE PIPELINES"],
  ["3", "TOGGLE FIELDS"],
  ["4", "TOGGLE TERMINALS"],
  ["5", "TOGGLE CHOKEPOINTS"],
  ["/", "FOCUS COMMAND BAR"],
  ["ESC", "CLEAR SELECTION / CLOSE HELP"],
  ["[", "TOGGLE LEFT RAIL"],
  ["]", "TOGGLE RIGHT RAIL"],
  ["\\", "TOGGLE ASSET GRID"],
  ["F", "TOGGLE FIRMS LAYER"],
  ["?", "OPEN SHORTCUTS"],
  ["REF RUWAIS", "SELECT REFINERY"],
  ["PIPE", "FOCUS PIPELINES"],
  ["DASH", "OPEN SITUATION ROOM"]
] as const;

export function ShortcutOverlay() {
  return (
    <section
      aria-label="SHORTCUTS"
      className={styles.overlay}
    >
      <header className={styles.header}>SHORTCUTS</header>
      <div className={styles.rows}>
        {SHORTCUT_ROWS.map(([keyLabel, description]) => (
          <div
            className={styles.row}
            key={keyLabel}
          >
            <span className={styles.key}>{keyLabel}</span>
            <span className={styles.description}>{description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
