import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeftRail } from "./LeftRail";
import { makeCatalog } from "../../test/fixtures";
import type { DatasetId } from "../../types/Infrastructure";
import type { EnergyType } from "../../utils/assetEnergy";
import { NO_FILTERS } from "../../utils/assetFilters";

const BASE_PROPS: Parameters<typeof LeftRail>[0] = {
  activeDatasetIds: [],
  activeEnergyTypes: [],
  catalog: makeCatalog(),
  countryOptions: [],
  energyCounts: { gas: 0, mixed: 0, ngl: 0, oil: 0 },
  filters: NO_FILTERS,
  layerCounts: { fields: 0, pipelines: 0, refineries: 0, terminals: 0 },
  onChangeFilters: () => undefined,
  onToggleDataset: () => undefined,
  onToggleEnergyType: () => undefined,
  onToggleUnmappedRoutes: () => undefined,
  operatorOptions: [],
  showUnmappedRoutes: true
};

function renderRail(overrides: Partial<Parameters<typeof LeftRail>[0]> = {}) {
  const props = {
    activeDatasetIds: ["refineries", "pipelines"] as DatasetId[],
    activeEnergyTypes: ["oil", "gas"] as EnergyType[],
    catalog: makeCatalog(),
    countryOptions: [
      { count: 151, label: "Iraq", value: "IQ" },
      { count: 106, label: "Saudi Arabia", value: "SA" }
    ],
    energyCounts: { gas: 304, mixed: 186, ngl: 9, oil: 409 },
    filters: NO_FILTERS,
    layerCounts: { fields: 437, pipelines: 400, refineries: 57, terminals: 21 },
    onChangeFilters: vi.fn(),
    onToggleDataset: vi.fn(),
    onToggleEnergyType: vi.fn(),
    onToggleUnmappedRoutes: vi.fn(),
    operatorOptions: [{ count: 62, label: "Saudi Aramco", value: "saudi-aramco" }],
    showUnmappedRoutes: true,
    ...overrides
  };

  render(<LeftRail {...props} />);
  return props;
}

describe("LeftRail", () => {
  it("lists every layer with its record count and on/off state", () => {
    renderRail();

    expect(screen.getByRole("checkbox", { name: /REFINERIES/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /OIL & GAS PIPELINES/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /OIL & GAS FIELDS/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /LNG TERMINALS/ })).not.toBeChecked();
    expect(screen.getByText("437")).toBeInTheDocument();
  });

  it("lists every energy type with its count and on/off state", () => {
    renderRail();

    expect(screen.getByRole("checkbox", { name: /CRUDE OIL/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /NATURAL GAS \/ LNG/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^NGL/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /OIL & GAS \(MIXED\)/ })).not.toBeChecked();
    expect(screen.getByText("409")).toBeInTheDocument();
  });

  it("reports layer and energy toggles separately", async () => {
    const user = userEvent.setup();
    const props = renderRail();

    await user.click(screen.getByRole("checkbox", { name: /OIL & GAS FIELDS/ }));
    await user.click(screen.getByRole("checkbox", { name: /^NGL/ }));

    expect(props.onToggleDataset).toHaveBeenCalledWith("fields");
    expect(props.onToggleEnergyType).toHaveBeenCalledWith("ngl");
  });

  it("explains what shape and colour mean, and the other map conventions", () => {
    renderRail();

    expect(screen.getByText("MARKER SHAPE")).toBeInTheDocument();
    expect(screen.getByText("MARKER COLOUR")).toBeInTheDocument();
    expect(screen.getByText("LNG export / LNG import")).toBeInTheDocument();
    expect(screen.getByText("Larger = more capacity")).toBeInTheDocument();
    expect(screen.getByText("Faded = not operating")).toBeInTheDocument();
    expect(screen.getByText("Dashed = route not mapped")).toBeInTheDocument();
  });

  it("lets the reader switch the dashed pipelines off, and says why they are dashed", async () => {
    const user = userEvent.setup();
    const props = renderRail();
    const toggle = screen.getByRole("checkbox", { name: "Dashed = route not mapped" });

    expect(toggle).toBeChecked();
    expect(screen.getByText("Only the two ends are known, so the line is straight.")).toBeInTheDocument();

    await user.click(toggle);

    expect(props.onToggleUnmappedRoutes).toHaveBeenCalledTimes(1);
  });

  it("offers three filters: country, operator and largest per layer", async () => {
    const user = userEvent.setup();
    renderRail();

    expect(screen.getByRole("button", { name: "COUNTRY: ALL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OPERATOR: ALL" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "LARGEST: ALL" }));

    expect(
      within(screen.getByRole("listbox", { name: "LARGEST" }))
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["ALL", "10 PER LAYER", "25 PER LAYER", "50 PER LAYER"]);
  });

  it("does not filter by status", () => {
    renderRail();

    expect(screen.queryByText(/STATUS/)).not.toBeInTheDocument();
  });

  it("reports each choice, keeping the other filters as they are", async () => {
    const user = userEvent.setup();
    const props = renderRail({ filters: { ...NO_FILTERS, countryCode: "SA" } });

    await user.click(screen.getByRole("button", { name: "OPERATOR: ALL" }));
    await user.click(screen.getByRole("option", { name: /Saudi Aramco/ }));
    await user.click(screen.getByRole("button", { name: "LARGEST: ALL" }));
    await user.click(screen.getByRole("option", { name: "25 PER LAYER" }));
    await user.click(screen.getByRole("button", { name: "COUNTRY: Saudi Arabia" }));
    await user.click(screen.getByRole("option", { name: "ALL" }));

    expect(props.onChangeFilters).toHaveBeenNthCalledWith(1, { countryCode: "SA", largestPerLayer: null, operatorId: "saudi-aramco" });
    expect(props.onChangeFilters).toHaveBeenNthCalledWith(2, { countryCode: "SA", largestPerLayer: 25, operatorId: null });
    expect(props.onChangeFilters).toHaveBeenNthCalledWith(3, NO_FILTERS);
  });

  it("shows the current choices and offers RESET only while a filter is set", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LeftRail {...BASE_PROPS} />);

    expect(screen.queryByRole("button", { name: "RESET" })).not.toBeInTheDocument();
    unmount();

    const props = renderRail({ filters: { countryCode: "IQ", largestPerLayer: 10, operatorId: null } });

    expect(screen.getByRole("button", { name: "COUNTRY: Iraq" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LARGEST: 10 PER LAYER" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "RESET" }));

    expect(props.onChangeFilters).toHaveBeenCalledWith(NO_FILTERS);
  });

  it("has no scrolling list of sources; those live on the About page", () => {
    renderRail();

    expect(screen.queryByText("SOURCES")).not.toBeInTheDocument();
  });
});
