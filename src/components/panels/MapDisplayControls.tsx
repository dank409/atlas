import { Panel } from "../common/Panel";
import type {
  ColorByOption,
  MapDisplaySettings,
  SizeByOption
} from "../../types/mapDisplaySettings";
import styles from "./MapDisplayControls.module.css";

interface MapDisplayControlsProps {
  settings: MapDisplaySettings;
  onChange: (next: MapDisplaySettings) => void;
}

const SIZE_BY_OPTIONS: { label: string; value: SizeByOption }[] = [
  { label: "CAPACITY", value: "capacity" },
  { label: "PRODUCTION", value: "production" },
  { label: "RESERVES", value: "reserves" },
  { label: "UNIFORM", value: "uniform" }
];

const COLOR_BY_OPTIONS: { label: string; value: ColorByOption }[] = [
  { label: "STATUS", value: "status" },
  { label: "HYDROCARBON", value: "hydrocarbon" }
];

export function MapDisplayControls({ settings, onChange }: MapDisplayControlsProps) {
  return (
    <Panel title="MAP DISPLAY">
      <div className={styles.controlGrid}>
        <div className={styles.controlRow}>
          <label className={styles.controlLabel} htmlFor="point-size-slider">
            POINT SIZE
          </label>
          <div className={styles.sliderRow}>
            <input
              className={styles.slider}
              id="point-size-slider"
              max={5}
              min={1}
              onChange={(e) =>
                onChange({ ...settings, pointSize: Number(e.target.value) })
              }
              step={1}
              type="range"
              value={settings.pointSize}
            />
            <span className={styles.sliderValue}>{settings.pointSize}</span>
          </div>
        </div>

        <div className={styles.controlRow}>
          <label className={styles.controlLabel} htmlFor="size-by-select">
            SIZE BY
          </label>
          <select
            className={styles.selectInput}
            id="size-by-select"
            onChange={(e) =>
              onChange({ ...settings, sizeBy: e.target.value as SizeByOption })
            }
            value={settings.sizeBy}
          >
            {SIZE_BY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.controlRow}>
          <label className={styles.controlLabel} htmlFor="color-by-select">
            COLOR BY
          </label>
          <select
            className={styles.selectInput}
            id="color-by-select"
            onChange={(e) =>
              onChange({
                ...settings,
                colorBy: e.target.value as ColorByOption
              })
            }
            value={settings.colorBy}
          >
            {COLOR_BY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>LABELS</span>
          <button
            aria-pressed={settings.showLabels}
            className={
              settings.showLabels
                ? styles.toggleButtonActive
                : styles.toggleButton
            }
            onClick={() =>
              onChange({ ...settings, showLabels: !settings.showLabels })
            }
            type="button"
          >
            {settings.showLabels ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
