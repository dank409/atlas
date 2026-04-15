import type { FirmsSnapshot, FirmsWindowHours } from "../../types/firms";
import styles from "./FirmsControlPanel.module.css";

// Window + confidence + visibility controls for the FIRMS pipeline.
// Designed to be mounted once in the situation room so the alert feed
// and the map share the same control surface. Dumb / stateless — all
// state lives in App.tsx and is threaded through props.

interface FirmsControlPanelProps {
  snapshot: FirmsSnapshot | null;
  windowHours: FirmsWindowHours;
  confidenceThreshold: number;
  isEnabled: boolean;
  onChangeWindow: (value: FirmsWindowHours) => void;
  onChangeConfidence: (value: number) => void;
  onToggleEnabled: () => void;
}

const WINDOW_OPTIONS: ReadonlyArray<{ label: string; value: FirmsWindowHours }> = [
  { label: "24H", value: 24 },
  { label: "72H", value: 72 },
  { label: "7D", value: 168 }
];

export function FirmsControlPanel({
  snapshot,
  windowHours,
  confidenceThreshold,
  isEnabled,
  onChangeWindow,
  onChangeConfidence,
  onToggleEnabled
}: FirmsControlPanelProps) {
  const mode = snapshot?.mode ?? "STATIC_SNAPSHOT";
  const asOf = snapshot?.asOf ?? "--";
  const detectionCount = snapshot?.detections.length ?? 0;
  const matchCount = snapshot?.matches.length ?? 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.metaRow}>
        <span className={styles.modeBadge} data-mode={mode}>
          {mode === "LIVE" ? "LIVE" : "STATIC"}
        </span>
        <span className={styles.separator}>|</span>
        <span>AS OF {asOf.slice(0, 16).replace("T", " ")}</span>
        <span className={styles.separator}>|</span>
        <span>
          {detectionCount} DETECT · {matchCount} MATCH
        </span>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>WINDOW</span>
        <div className={styles.windowButtons} role="group" aria-label="FIRMS window selector">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === windowHours
                  ? styles.windowButtonActive
                  : styles.windowButton
              }
              aria-pressed={option.value === windowHours}
              onClick={() => onChangeWindow(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>
          CONFIDENCE THRESHOLD
        </span>
        <div className={styles.sliderRow}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={confidenceThreshold}
            aria-label="FIRMS confidence threshold"
            onChange={(event) => onChangeConfidence(Number(event.target.value))}
          />
          <span className={styles.sliderValue}>{confidenceThreshold}</span>
        </div>
      </div>

      <div className={styles.toggleRow}>
        <span className={styles.groupLabel}>LAYER</span>
        <button
          type="button"
          className={isEnabled ? styles.toggleButtonOn : styles.toggleButton}
          aria-pressed={isEnabled}
          onClick={onToggleEnabled}
        >
          {isEnabled ? "VISIBLE" : "HIDDEN"}
        </button>
      </div>

      <div className={styles.hintLine}>
        PRESS F TO TOGGLE · VIIRS_SNPP_NRT · GEOFENCED TO KNOWN ASSETS
      </div>
    </div>
  );
}
