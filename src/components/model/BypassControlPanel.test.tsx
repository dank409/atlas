import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BypassControlPanel } from "./BypassControlPanel";
import { runBypassScenario } from "../../utils/bypassModel";

function renderPanel(overrides: { disruptionPercentage?: number } = {}) {
  const disruptionPercentage = overrides.disruptionPercentage ?? 0;
  const result = runBypassScenario({ disruptionPct: disruptionPercentage });
  const onDisruptionChange = vi.fn();
  const onSaudiChange = vi.fn();
  const onUaeChange = vi.fn();
  const onIeaChange = vi.fn();
  const onReset = vi.fn();

  render(
    <BypassControlPanel
      disruptionPercentage={disruptionPercentage}
      ieaReleaseRate={0}
      onDisruptionChange={onDisruptionChange}
      onIeaChange={onIeaChange}
      onReset={onReset}
      onSaudiChange={onSaudiChange}
      onUaeChange={onUaeChange}
      result={result}
      saudiUtilization={0}
      uaeUtilization={0}
    />
  );

  return { onDisruptionChange, onReset, result };
}

describe("BypassControlPanel", () => {
  it("renders the modeler title and IDLE badge when disruption is zero", () => {
    renderPanel();
    expect(screen.getByText("HORMUZ BYPASS MODELER")).toBeInTheDocument();
    expect(screen.getByText("IDLE")).toBeInTheDocument();
    expect(screen.getByText("EQUILIBRIUM")).toBeInTheDocument();
  });

  it("flips to SCENARIO ACTIVE badge once disruption is non-zero", () => {
    renderPanel({ disruptionPercentage: 60 });
    expect(screen.getByText("SCENARIO ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("DEPLETING")).toBeInTheDocument();
  });

  it("renders all four scenario sliders", () => {
    renderPanel();
    expect(
      screen.getByLabelText("Hormuz disruption percentage")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Saudi East-West bypass spare capacity override")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("UAE ADCOP bypass spare capacity override")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("IEA coordinated release rate override")
    ).toBeInTheDocument();
  });

  it("invokes the disruption change handler when the slider moves", () => {
    const { onDisruptionChange } = renderPanel();
    const slider = screen.getByLabelText("Hormuz disruption percentage");
    fireEvent.change(slider, { target: { value: "45" } });
    expect(onDisruptionChange).toHaveBeenCalledWith(45);
  });

  it("disables the reset button while the scenario is at rest", () => {
    renderPanel();
    const reset = screen.getByRole("button", { name: "RESET SCENARIO" });
    expect(reset).toBeDisabled();
  });

  it("enables the reset button once a scenario is engaged", () => {
    const { onReset } = renderPanel({ disruptionPercentage: 25 });
    const reset = screen.getByRole("button", { name: "RESET SCENARIO" });
    expect(reset).not.toBeDisabled();
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders the breach countdown for a depleting scenario", () => {
    const { result } = renderPanel({ disruptionPercentage: 100 });
    // 100% Hormuz disruption depletes inventory in well under 30 days,
    // which is the red-tone threshold the panel applies.
    expect(result.daysToOperationalMinimum).not.toBeNull();
    expect(result.daysToOperationalMinimum!).toBeLessThan(30);
    const expected = `${result.daysToOperationalMinimum!.toFixed(1)} D`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("falls back to the IEA cap horizon when IEA fully absorbs the post-bypass deficit", () => {
    // At 40% disruption the post-bypass deficit is fully absorbed by IEA
    // release → state is EQUILIBRIUM → daysToOperationalMinimum is null.
    // The tile used to render "--" here, which hides a real trader signal.
    // It should now show the IEA cap exhaustion horizon in days.
    const { result } = renderPanel({ disruptionPercentage: 40 });
    expect(result.daysToOperationalMinimum).toBeNull();
    expect(result.ieaExhaustionDays).not.toBeNull();

    const expected = `IEA CAP ${result.ieaExhaustionDays!.toFixed(0)} D`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("shows -- on the breach tile when the scenario is idle (no deficit, no IEA draw)", () => {
    renderPanel();
    expect(screen.getByText("--")).toBeInTheDocument();
  });
});
