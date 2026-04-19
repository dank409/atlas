import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { ModelsPage } from "./ModelsPage";
import { useBypassModel } from "../hooks/useBypassModel";

// The bypass model hook owns the sliders' state, so each test
// creates a fresh hook result and hands it to the page. Using the
// real hook rather than a shallow mock means the backtest + outcome
// tiles render against the real pure-function math.
function renderModels(overrides: Partial<React.ComponentProps<typeof ModelsPage>> = {}) {
  const { result } = renderHook(() => useBypassModel());
  return render(
    <ModelsPage
      bypassModel={result.current}
      onNavigateToMap={overrides.onNavigateToMap}
      outageEvents={[]}
      {...overrides}
    />
  );
}

describe("ModelsPage", () => {
  it("renders the scenario inputs panel at rest", () => {
    renderModels();
    expect(screen.getByText("SCENARIO INPUTS")).toBeDefined();
    expect(screen.getByText("HORMUZ DISRUPTION")).toBeDefined();
    expect(screen.getByText("PRESETS")).toBeDefined();
  });

  it("hides the scenario-live status strip when disruption is 0", () => {
    renderModels();
    expect(screen.queryByText("SCENARIO LIVE")).toBeNull();
  });

  it("shows the status strip + preset descriptions when the preset row is rendered", () => {
    renderModels();
    expect(screen.getByText("STATUS QUO")).toBeDefined();
    expect(screen.getByText("HORMUZ TENSION (10%)")).toBeDefined();
    expect(screen.getByText("PARTIAL CLOSURE (40%)")).toBeDefined();
    expect(screen.getByText("FULL CLOSURE (90%)")).toBeDefined();
  });

  it("engages the scenario strip when the HORMUZ TENSION preset is clicked", () => {
    const { result } = renderHook(() => useBypassModel());
    const onNavigateToMap = vi.fn();
    const { rerender } = render(
      <ModelsPage
        bypassModel={result.current}
        onNavigateToMap={onNavigateToMap}
        outageEvents={[]}
      />
    );
    act(() => {
      result.current.setDisruptionPercentage(40);
    });
    rerender(
      <ModelsPage
        bypassModel={result.current}
        onNavigateToMap={onNavigateToMap}
        outageEvents={[]}
      />
    );
    expect(screen.getByText("SCENARIO LIVE")).toBeDefined();
    fireEvent.click(screen.getByText(/VIEW ON MAP/));
    expect(onNavigateToMap).toHaveBeenCalledTimes(1);
  });

  it("renders the backtest + assumption sections", () => {
    renderModels();
    expect(screen.getByText(/BACKTESTS · MODEL VS REALIZED/)).toBeDefined();
    expect(screen.getByText(/2019 · ABQAIQ DRONE STRIKE/)).toBeDefined();
    expect(screen.getByText(/MODEL ASSUMPTIONS/)).toBeDefined();
  });
});
