import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_BYPASS_CONSTANTS,
  runBypassScenario,
  type BypassConstants,
  type BypassModelResult
} from "../utils/bypassModel";

/**
 * Global state for the Hormuz Bypass Modeler vertical slice.
 *
 * The four numeric inputs are intentionally flat primitives — both the
 * sidebar control panel and downstream visual surfaces (dashboard outputs,
 * map mode badge, future map-layer overrides) read directly from this hook,
 * so a single source-of-truth pattern means no panel ever recomputes the
 * model independently.
 *
 * Defaults are all 0 per the vertical-slice spec. A value of 0 on the
 * Saudi/UAE/IEA sliders means "use the commercial baseline constant from
 * bypassModel.ts" — those overrides are only applied when the user pushes
 * the slider above zero, so the user is never silently driving the model
 * with a bogus zero-spare-capacity assumption.
 */
export interface BypassModelControls {
  disruptionPercentage: number;
  saudiUtilization: number;
  uaeUtilization: number;
  ieaReleaseRate: number;
}

export interface UseBypassModelResult extends BypassModelControls {
  result: BypassModelResult;
  isScenarioActive: boolean;
  setDisruptionPercentage: (value: number) => void;
  setSaudiUtilization: (value: number) => void;
  setUaeUtilization: (value: number) => void;
  setIeaReleaseRate: (value: number) => void;
  resetScenario: () => void;
}

export function useBypassModel(): UseBypassModelResult {
  const [disruptionPercentage, setDisruptionPercentage] = useState(0);
  const [saudiUtilization, setSaudiUtilization] = useState(0);
  const [uaeUtilization, setUaeUtilization] = useState(0);
  const [ieaReleaseRate, setIeaReleaseRate] = useState(0);

  const result = useMemo(() => {
    const overrides: Partial<BypassConstants> = {};

    // Slider value of 0 = "use commercial baseline." Only push an override
    // into the model when the user has explicitly moved the slider, so a
    // resting state always reflects the stress-tested defaults rather than
    // a degenerate zero-capacity scenario.
    if (saudiUtilization > 0) {
      overrides.saudiSpareCapacityMbpd = saudiUtilization;
    }
    if (uaeUtilization > 0) {
      overrides.uaeSpareCapacityMbpd = uaeUtilization;
    }
    if (ieaReleaseRate > 0) {
      overrides.ieaMaxRateMbpd = ieaReleaseRate;
    }

    return runBypassScenario({
      disruptionPct: disruptionPercentage,
      overrides
    });
  }, [disruptionPercentage, saudiUtilization, uaeUtilization, ieaReleaseRate]);

  const resetScenario = useCallback(() => {
    setDisruptionPercentage(0);
    setSaudiUtilization(0);
    setUaeUtilization(0);
    setIeaReleaseRate(0);
  }, []);

  return {
    disruptionPercentage,
    saudiUtilization,
    uaeUtilization,
    ieaReleaseRate,
    result,
    isScenarioActive: disruptionPercentage > 0,
    setDisruptionPercentage,
    setSaudiUtilization,
    setUaeUtilization,
    setIeaReleaseRate,
    resetScenario
  };
}

export { DEFAULT_BYPASS_CONSTANTS };
