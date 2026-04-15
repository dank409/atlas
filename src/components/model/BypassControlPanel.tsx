import { Panel } from "../common/Panel";
import {
  DEFAULT_BYPASS_CONSTANTS,
  type BypassModelResult,
  type BypassModelState
} from "../../utils/bypassModel";
import styles from "./BypassControlPanel.module.css";

interface BypassControlPanelProps {
  disruptionPercentage: number;
  saudiUtilization: number;
  uaeUtilization: number;
  ieaReleaseRate: number;
  result: BypassModelResult;
  onDisruptionChange: (value: number) => void;
  onSaudiChange: (value: number) => void;
  onUaeChange: (value: number) => void;
  onIeaChange: (value: number) => void;
  onReset: () => void;
}

export function BypassControlPanel({
  disruptionPercentage,
  saudiUtilization,
  uaeUtilization,
  ieaReleaseRate,
  result,
  onDisruptionChange,
  onSaudiChange,
  onUaeChange,
  onIeaChange,
  onReset
}: BypassControlPanelProps) {
  const isActive = disruptionPercentage > 0;
  const stateColor = stateColorClass(result.state, result.daysToOperationalMinimum);

  return (
    <Panel
      badge={isActive ? "SCENARIO ACTIVE" : "IDLE"}
      title="HORMUZ BYPASS MODELER"
    >
      <div className={styles.body}>
        <ScenarioSlider
          ariaLabel="Hormuz disruption percentage"
          displayValue={`${disruptionPercentage.toFixed(0)}%`}
          fillPct={disruptionPercentage / 100}
          label="DISRUPTION"
          max={100}
          min={0}
          onChange={onDisruptionChange}
          step={1}
          value={disruptionPercentage}
        />
        <ScenarioSlider
          ariaLabel="Saudi East-West bypass spare capacity override"
          displayValue={
            saudiUtilization > 0
              ? `${saudiUtilization.toFixed(2)} MBPD`
              : `AUTO ${DEFAULT_BYPASS_CONSTANTS.saudiSpareCapacityMbpd.toFixed(2)}`
          }
          fillPct={saudiUtilization / 7}
          label="SAUDI BYPASS"
          max={7}
          min={0}
          onChange={onSaudiChange}
          step={0.1}
          value={saudiUtilization}
        />
        <ScenarioSlider
          ariaLabel="UAE ADCOP bypass spare capacity override"
          displayValue={
            uaeUtilization > 0
              ? `${uaeUtilization.toFixed(2)} MBPD`
              : `AUTO ${DEFAULT_BYPASS_CONSTANTS.uaeSpareCapacityMbpd.toFixed(2)}`
          }
          fillPct={uaeUtilization / 1.5}
          label="UAE BYPASS"
          max={1.5}
          min={0}
          onChange={onUaeChange}
          step={0.05}
          value={uaeUtilization}
        />
        <ScenarioSlider
          ariaLabel="IEA coordinated release rate override"
          displayValue={
            ieaReleaseRate > 0
              ? `${ieaReleaseRate.toFixed(2)} MBPD`
              : `AUTO ${DEFAULT_BYPASS_CONSTANTS.ieaMaxRateMbpd.toFixed(2)}`
          }
          fillPct={ieaReleaseRate / 4}
          label="IEA RELEASE"
          max={4}
          min={0}
          onChange={onIeaChange}
          step={0.1}
          value={ieaReleaseRate}
        />

        <div className={styles.outputs}>
          <div className={styles.outputRow}>
            <span className={styles.outputLabel}>STATE</span>
            <span
              className={styles.outputValue}
              data-tone={stateColor}
            >
              {result.state}
            </span>
          </div>
          <div className={styles.outputRow}>
            <span className={styles.outputLabel}>GROSS DISRUPTED</span>
            <span className={styles.outputValue}>
              {result.grossDisruptedMbpd.toFixed(2)} MBPD
            </span>
          </div>
          <div className={styles.outputRow}>
            <span className={styles.outputLabel}>BYPASS UTILISED</span>
            <span className={styles.outputValue}>
              {result.totalBypassUtilisedMbpd.toFixed(2)} MBPD
            </span>
          </div>
          <div className={styles.outputRow}>
            <span className={styles.outputLabel}>IEA RELEASE</span>
            <span className={styles.outputValue}>
              {result.ieaDailyReleaseMbpd.toFixed(2)} MBPD
            </span>
          </div>
          <div className={styles.outputRow}>
            <span className={styles.outputLabel}>NET DEFICIT</span>
            <span
              className={styles.outputValue}
              data-tone={result.netDailyDeficitMbpd > 0 ? "red" : "green"}
            >
              {result.netDailyDeficitMbpd.toFixed(2)} MBPD
            </span>
          </div>
          <div className={styles.outputRow}>
            <span className={styles.outputLabel}>DAYS TO BREACH</span>
            <span
              className={styles.outputValue}
              data-tone={daysToBreachTone(result)}
            >
              {result.daysToOperationalMinimum !== null
                ? `${result.daysToOperationalMinimum.toFixed(1)} D`
                : result.ieaExhaustionDays !== null
                  ? `IEA CAP ${result.ieaExhaustionDays.toFixed(0)} D`
                  : "--"}
            </span>
          </div>
        </div>

        <div className={styles.rationale}>{result.rationale}</div>

        <div className={styles.sourceLine}>
          HORMUZ {result.constants.hormuzCrudeFlowMbpd.toFixed(1)} MBPD ·
          {" "}SAUDI {result.constants.saudiSpareCapacityMbpd.toFixed(2)} ·
          {" "}UAE {result.constants.uaeSpareCapacityMbpd.toFixed(2)} ·
          {" "}IEA {result.constants.ieaMaxRateMbpd.toFixed(1)}/{result.constants.ieaCumulativeCapMb} MB
        </div>

        <button
          className={styles.resetButton}
          disabled={!isActive && saudiUtilization === 0 && uaeUtilization === 0 && ieaReleaseRate === 0}
          onClick={onReset}
          type="button"
        >
          RESET SCENARIO
        </button>
      </div>
    </Panel>
  );
}

interface ScenarioSliderProps {
  ariaLabel: string;
  displayValue: string;
  fillPct: number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}

function ScenarioSlider({
  ariaLabel,
  displayValue,
  fillPct,
  label,
  max,
  min,
  onChange,
  step,
  value
}: ScenarioSliderProps) {
  const clampedFill = Math.max(0, Math.min(1, fillPct));
  return (
    <div className={styles.sliderBlock}>
      <div className={styles.sliderHeader}>
        <span className={styles.sliderLabel}>{label}</span>
        <span className={styles.sliderValue}>{displayValue}</span>
      </div>
      <div className={styles.sliderTrackWrap}>
        <div className={styles.sliderTrack}>
          <div
            className={styles.sliderFill}
            style={{ width: `${clampedFill * 100}%` }}
          />
        </div>
        <input
          aria-label={ariaLabel}
          className={styles.sliderInput}
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="range"
          value={value}
        />
      </div>
    </div>
  );
}

function stateColorClass(
  state: BypassModelState,
  daysToBreach: number | null
): "green" | "amber" | "red" {
  if (state === "EQUILIBRIUM" || state === "REPLENISHING") {
    return "green";
  }
  if (daysToBreach !== null && daysToBreach < 30) {
    return "red";
  }
  return "amber";
}

function daysToBreachTone(result: BypassModelResult): "muted" | "amber" | "red" {
  if (result.daysToOperationalMinimum !== null) {
    return result.daysToOperationalMinimum < 30 ? "red" : "amber";
  }
  // Equilibrium sustained by IEA: surface the IEA cap horizon as an amber
  // warning, not a neutral `--`. The physics are tractable; the trader just
  // needs the next-most-relevant number.
  if (result.ieaExhaustionDays !== null) {
    return "amber";
  }
  return "muted";
}
