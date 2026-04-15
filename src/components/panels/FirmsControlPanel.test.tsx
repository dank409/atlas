import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirmsControlPanel } from "./FirmsControlPanel";
import type { FirmsSnapshot } from "../../types/firms";

const snapshot: FirmsSnapshot = {
  mode: "STATIC_SNAPSHOT",
  asOf: "2026-04-14T12:00:00Z",
  windowHours: 72,
  confidenceThreshold: 80,
  detections: [],
  matches: [],
  anomalies: [],
  source: "Curated test snapshot"
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof FirmsControlPanel>> = {}
) {
  const props: React.ComponentProps<typeof FirmsControlPanel> = {
    snapshot,
    windowHours: 72,
    confidenceThreshold: 80,
    isEnabled: true,
    onChangeWindow: vi.fn(),
    onChangeConfidence: vi.fn(),
    onToggleEnabled: vi.fn(),
    ...overrides
  };
  return { props, utils: render(<FirmsControlPanel {...props} />) };
}

describe("FirmsControlPanel", () => {
  it("renders the window selector buttons and marks the active window", () => {
    renderPanel();

    const buttons = screen.getAllByRole("button", { name: /24H|72H|7D/ });
    expect(buttons).toHaveLength(3);
    const seventyTwo = screen.getByRole("button", { name: "72H" });
    expect(seventyTwo).toHaveAttribute("aria-pressed", "true");
    const twentyFour = screen.getByRole("button", { name: "24H" });
    expect(twentyFour).toHaveAttribute("aria-pressed", "false");
  });

  it("invokes onChangeWindow with the new window on click", () => {
    const onChangeWindow = vi.fn();
    renderPanel({ onChangeWindow });
    fireEvent.click(screen.getByRole("button", { name: "24H" }));
    expect(onChangeWindow).toHaveBeenCalledWith(24);
    fireEvent.click(screen.getByRole("button", { name: "7D" }));
    expect(onChangeWindow).toHaveBeenCalledWith(168);
  });

  it("renders the confidence slider and emits onChangeConfidence", () => {
    const onChangeConfidence = vi.fn();
    renderPanel({ onChangeConfidence });
    const slider = screen.getByLabelText("FIRMS confidence threshold");
    fireEvent.change(slider, { target: { value: "45" } });
    expect(onChangeConfidence).toHaveBeenCalledWith(45);
  });

  it("shows the confidence value beside the slider", () => {
    renderPanel({ confidenceThreshold: 70 });
    expect(screen.getByText("70")).toBeInTheDocument();
  });

  it("renders a STATIC_SNAPSHOT mode badge when the snapshot is static", () => {
    renderPanel();
    const badge = document.querySelector('[data-mode="STATIC_SNAPSHOT"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe("STATIC");
  });

  it("flips the layer-visibility toggle and emits onToggleEnabled", () => {
    const onToggleEnabled = vi.fn();
    renderPanel({ onToggleEnabled, isEnabled: true });
    const toggle = screen.getByRole("button", { name: "VISIBLE" });
    fireEvent.click(toggle);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it("renders HIDDEN label when the layer is disabled", () => {
    renderPanel({ isEnabled: false });
    expect(screen.getByRole("button", { name: "HIDDEN" })).toBeInTheDocument();
  });
});
