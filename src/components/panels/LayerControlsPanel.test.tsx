import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LayerControlsPanel } from "./LayerControlsPanel";

const COUNTRY_OPTIONS = [
  { label: "SAUDI ARABIA", value: "SA" },
  { label: "UAE", value: "AE" }
];

const STATUS_OPTIONS: Array<{ label: string; value: "operational" | "planned_startup" }> = [
  { label: "OPERATIONAL", value: "operational" },
  { label: "PLANNED STARTUP", value: "planned_startup" }
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof LayerControlsPanel>> = {}) {
  const props: React.ComponentProps<typeof LayerControlsPanel> = {
    countryFilter: "ALL",
    countryOptions: COUNTRY_OPTIONS,
    isRefineriesVisible: true,
    onCountryFilterChange: vi.fn(),
    onStatusFilterChange: vi.fn(),
    onToggleRefineries: vi.fn(),
    refineryTotalCount: 42,
    refineryVisibleCount: 10,
    statusFilter: "ALL",
    statusOptions: STATUS_OPTIONS,
    ...overrides
  };
  return { props, utils: render(<LayerControlsPanel {...props} />) };
}

describe("LayerControlsPanel", () => {
  it("renders the refineries toggle with the visible/total badge", () => {
    renderPanel();

    expect(screen.getByText("LAYER CONTROLS")).toBeInTheDocument();
    expect(screen.getByText("10/42 assets")).toBeInTheDocument();
    expect(screen.getByText("REFINERIES")).toBeInTheDocument();
    expect(screen.getByText("VISIBLE")).toBeInTheDocument();
  });

  it("shows HIDDEN when the refineries layer is off", () => {
    renderPanel({ isRefineriesVisible: false });

    expect(screen.getByText("HIDDEN")).toBeInTheDocument();
  });

  it("invokes onToggleRefineries when the layer button is clicked", () => {
    const onToggleRefineries = vi.fn();
    renderPanel({ onToggleRefineries });

    fireEvent.click(screen.getByRole("button", { name: "Toggle refineries layer" }));
    expect(onToggleRefineries).toHaveBeenCalledTimes(1);
  });

  it("renders country and status filter options and emits changes", () => {
    const onCountryFilterChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    renderPanel({ onCountryFilterChange, onStatusFilterChange });

    const countrySelect = screen.getByLabelText("Country filter");
    const statusSelect = screen.getByLabelText("Status filter");
    expect(countrySelect).toBeInTheDocument();
    expect(statusSelect).toBeInTheDocument();

    fireEvent.change(countrySelect, { target: { value: "SA" } });
    expect(onCountryFilterChange).toHaveBeenCalledWith("SA");

    fireEvent.change(statusSelect, { target: { value: "operational" } });
    expect(onStatusFilterChange).toHaveBeenCalledWith("operational");
  });
});
