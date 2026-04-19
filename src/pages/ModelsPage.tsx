import { useMemo } from "react";
import { Panel } from "../components/common/Panel";
import type { UseBypassModelResult } from "../hooks/useBypassModel";
import type { OutageEvent } from "../types/outageEvent";
import { runBypassScenario } from "../utils/bypassModel";
import styles from "./ModelsPage.module.css";

interface ModelsPageProps {
  bypassModel: UseBypassModelResult;
  outageEvents: OutageEvent[];
}

interface Preset {
  id: string;
  label: string;
  disruptionPct: number;
  description: string;
}

// Explicit, curated presets for stress-testing. Each is an honest
// invocation of the bypass model with no hidden parameters.
const PRESETS: Preset[] = [
  {
    id: "status_quo",
    label: "STATUS QUO",
    disruptionPct: 0,
    description: "Quiet day. No disruption engaged. Bypass capacity idle."
  },
  {
    id: "hormuz_tension",
    label: "HORMUZ TENSION (10%)",
    disruptionPct: 10,
    description: "Heightened tension, limited physical disruption. Bypass mostly absorbs."
  },
  {
    id: "partial_closure",
    label: "PARTIAL CLOSURE (40%)",
    disruptionPct: 40,
    description: "Meaningful physical disruption. Net deficit turns positive after bypass."
  },
  {
    id: "full_closure",
    label: "FULL CLOSURE (90%)",
    disruptionPct: 90,
    description: "Near-total interdiction. Bypass saturates, OECD inventories draw hard."
  }
];

// Curated historical shocks for the backtest section. Each row lists
// the realised Brent move + the disruption assumption we'd feed into
// the bypass model to replay it. Realised values come from EIA/ICE
// history. The bypass model output is computed live using the same
// pure function the scenario slider consumes — no fake backtests.
const BACKTESTS = [
  {
    id: "abqaiq_2019",
    label: "2019 · ABQAIQ DRONE STRIKE",
    assumptionPct: 60,
    realisedBrentMove: "+14.6%",
    narrative:
      "14 Sep 2019: drone strike removes ≈5.7 Mbpd of Saudi processing for ≈12 days. Brent gapped +14.6% on first trading session; normalised within 3 weeks."
  },
  {
    id: "red_sea_2024",
    label: "2024 · RED SEA / HOUTHI CAMPAIGN",
    assumptionPct: 20,
    realisedBrentMove: "+6.8% (20d)",
    narrative:
      "Persistent Bab-el-Mandeb attacks reduce Red Sea transits ≈50%. Rerouting via Cape adds ~10 days and freight costs but physical barrels still arrive."
  },
  {
    id: "opec_cut_2023",
    label: "2023 · OPEC+ SURPRISE CUT",
    assumptionPct: 15,
    realisedBrentMove: "+7.4%",
    narrative:
      "Apr 2023: voluntary cuts remove ≈1.15 Mbpd. Functionally a demand-side disruption, modelled here as a Hormuz-proxy since it's a flow reduction."
  }
];

export function ModelsPage({ bypassModel, outageEvents }: ModelsPageProps) {
  const { result, disruptionPercentage, setDisruptionPercentage } = bypassModel;

  const backtestResults = useMemo(
    () =>
      BACKTESTS.map((b) => ({
        ...b,
        modelled: runBypassScenario({ disruptionPct: b.assumptionPct })
      })),
    []
  );

  return (
    <div className={styles.page}>
      <aside className={styles.inputsCol}>
        <Panel badge="STRESS TEST" title="SCENARIO INPUTS">
          <SliderRow
            label="HORMUZ DISRUPTION"
            max={100}
            min={0}
            onChange={setDisruptionPercentage}
            step={1}
            value={disruptionPercentage}
            valueLabel={`${disruptionPercentage}%`}
          />
          <SliderRow
            label="SAUDI SPARE OVERRIDE"
            max={7}
            min={0}
            onChange={bypassModel.setSaudiUtilization}
            step={0.1}
            value={bypassModel.saudiUtilization}
            valueLabel={`${bypassModel.saudiUtilization.toFixed(1)} MBPD`}
          />
          <SliderRow
            label="UAE SPARE OVERRIDE"
            max={3}
            min={0}
            onChange={bypassModel.setUaeUtilization}
            step={0.1}
            value={bypassModel.uaeUtilization}
            valueLabel={`${bypassModel.uaeUtilization.toFixed(1)} MBPD`}
          />
          <SliderRow
            label="IEA RELEASE RATE"
            max={4.4}
            min={0}
            onChange={bypassModel.setIeaReleaseRate}
            step={0.1}
            value={bypassModel.ieaReleaseRate}
            valueLabel={`${bypassModel.ieaReleaseRate.toFixed(1)} MBPD`}
          />
        </Panel>

        <Panel title="PRESETS">
          <div className={styles.presetList}>
            {PRESETS.map((preset) => (
              <button
                className={
                  preset.disruptionPct === disruptionPercentage
                    ? styles.presetActive
                    : styles.preset
                }
                key={preset.id}
                onClick={() => setDisruptionPercentage(preset.disruptionPct)}
                type="button"
              >
                <span className={styles.presetLabel}>{preset.label}</span>
                <span className={styles.presetDescription}>{preset.description}</span>
              </button>
            ))}
          </div>
        </Panel>
      </aside>

      <section className={styles.outputsCol}>
        <Panel badge="BYPASS MODEL" title="MODELED OUTCOME">
          <div className={styles.outcomeGrid}>
            <OutputStat
              label="STATE"
              tone={stateTone(result.state)}
              value={result.state}
            />
            <OutputStat
              label="GROSS DISRUPTED"
              unit="MBPD"
              value={result.grossDisruptedMbpd.toFixed(2)}
            />
            <OutputStat
              label="BYPASS UTILISED"
              unit="MBPD"
              value={result.totalBypassUtilisedMbpd.toFixed(2)}
            />
            <OutputStat
              label="IEA RELEASE"
              unit="MBPD"
              value={result.ieaDailyReleaseMbpd.toFixed(2)}
            />
            <OutputStat
              label="NET DEFICIT"
              tone={result.netDailyDeficitMbpd > 0 ? "neg" : "pos"}
              unit="MBPD"
              value={result.netDailyDeficitMbpd.toFixed(2)}
            />
            <OutputStat
              label="DAYS TO OECD MIN"
              tone={
                result.daysToOperationalMinimum !== null &&
                result.daysToOperationalMinimum < 60
                  ? "neg"
                  : "neutral"
              }
              unit={result.daysToOperationalMinimum !== null ? "D" : undefined}
              value={
                result.daysToOperationalMinimum !== null
                  ? result.daysToOperationalMinimum.toFixed(1)
                  : "--"
              }
            />
          </div>
          <div className={styles.rationale}>{result.rationale}</div>
        </Panel>

        <Panel badge="3 HISTORICAL SHOCKS" title="BACKTESTS · MODEL VS REALIZED">
          <table className={styles.backtestTable}>
            <thead>
              <tr>
                <th>EVENT</th>
                <th>ASSUMPTION</th>
                <th>MODEL NET DEFICIT</th>
                <th>DAYS TO OECD MIN</th>
                <th>REALISED BRENT</th>
              </tr>
            </thead>
            <tbody>
              {backtestResults.map((row) => (
                <tr className={styles.backtestRow} key={row.id}>
                  <td className={styles.backtestLabel}>{row.label}</td>
                  <td className={styles.backtestAssumption}>
                    HORMUZ {row.assumptionPct}%
                  </td>
                  <td className={styles.backtestNumeric}>
                    {row.modelled.netDailyDeficitMbpd.toFixed(2)} MBPD
                  </td>
                  <td className={styles.backtestNumeric}>
                    {row.modelled.daysToOperationalMinimum !== null
                      ? `${row.modelled.daysToOperationalMinimum.toFixed(1)}D`
                      : "--"}
                  </td>
                  <td className={styles.backtestRealised}>{row.realisedBrentMove}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.backtestFooter}>
            Backtests reference {outageEvents.length} curated outage events for
            narrative context. Each row re-runs the same bypass model used by
            the live scenario slider — no separate historical model.
          </div>
        </Panel>

        <Panel title="MODEL ASSUMPTIONS">
          <table className={styles.assumptionsTable}>
            <tbody>
              <AssumptionRow label="Hormuz baseline flow" value="20.5 MBPD" source="EIA 2024" />
              <AssumptionRow label="Saudi bypass spare" value="1.1 MBPD" source="Petroline operator disclosure" />
              <AssumptionRow label="UAE bypass spare" value="0.5 MBPD" source="ADCOP operator disclosure" />
              <AssumptionRow label="IEA max release rate" value="4.4 MBPD" source="IEA coordinated-release cap" />
              <AssumptionRow label="OECD operational minimum" value="2700 MBBL" source="IEA 90-day cover rule" />
              <AssumptionRow label="Starting OECD commercial" value="2900 MBBL" source="IEA monthly report (curated)" />
            </tbody>
          </table>
        </Panel>
      </section>
    </div>
  );
}

function stateTone(state: string): OutputTone {
  if (state === "EQUILIBRIUM") return "neutral";
  if (state === "REPLENISHING") return "pos";
  return "neg";
}

type OutputTone = "pos" | "neg" | "neutral";

function OutputStat({
  label,
  value,
  unit,
  tone = "neutral"
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: OutputTone;
}) {
  return (
    <div className={styles.outputStat}>
      <span className={styles.outputLabel}>{label}</span>
      <span className={`${styles.outputValue} ${toneClass(tone, styles)}`}>{value}</span>
      {unit ? <span className={styles.outputUnit}>{unit}</span> : null}
    </div>
  );
}

function toneClass(tone: OutputTone, stylesMap: Record<string, string>): string {
  if (tone === "pos") return stylesMap.tonePos;
  if (tone === "neg") return stylesMap.toneNeg;
  return stylesMap.toneNeutral;
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  valueLabel,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderHead}>
        <span className={styles.sliderLabel}>{label}</span>
        <span className={styles.sliderValue}>{valueLabel}</span>
      </div>
      <input
        aria-label={label}
        className={styles.slider}
        max={max}
        min={min}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <div className={styles.sliderBounds}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function AssumptionRow({
  label,
  value,
  source
}: {
  label: string;
  value: string;
  source: string;
}) {
  return (
    <tr>
      <td className={styles.assumptionLabel}>{label}</td>
      <td className={styles.assumptionValue}>{value}</td>
      <td className={styles.assumptionSource}>{source}</td>
    </tr>
  );
}
