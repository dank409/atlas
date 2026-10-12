import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TablePage } from "./TablePage";
import { makeCatalogEntry, makeField, makeRefinery } from "../test/fixtures";

const refineries = makeCatalogEntry("refineries", { source: "EDF OGIM" });
const fields = makeCatalogEntry("fields");
const ruwais = makeRefinery();
const abadan = makeRefinery({ countryName: "Iran", id: "refinery-abadan", name: "Abadan Refinery", operator: "NIOC" });
const ghawar = makeField();

function renderPage(overrides: Partial<Parameters<typeof TablePage>[0]> = {}) {
  const props = {
    activeDatasets: [refineries, fields],
    focusedDataset: refineries,
    onFocusDataset: vi.fn(),
    onSelectAsset: vi.fn(),
    selectedAssetId: null,
    visibleAssets: [ruwais, abadan, ghawar],
    ...overrides
  };

  render(<TablePage {...props} />);
  return props;
}

describe("TablePage", () => {
  it("shows only the focused layer's rows, with that layer's source", () => {
    renderPage();

    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();
    expect(screen.queryByText("Ghawar Oil Field")).not.toBeInTheDocument();
    expect(screen.getByText("2 ROWS")).toBeInTheDocument();
    expect(screen.getByText("SOURCE: EDF OGIM · 2025-03-28")).toBeInTheDocument();
  });

  it("offers one tab per visible layer and reports tab changes", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["REFINERIES", "OIL & GAS FIELDS"]);
    expect(screen.getByRole("tab", { name: "REFINERIES" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "OIL & GAS FIELDS" }));

    expect(props.onFocusDataset).toHaveBeenCalledWith("fields");
  });

  it("filters rows by text and says how many of the layer are left", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "Filter rows" }), "iran");

    expect(screen.getByText("1 OF 2 ROWS")).toBeInTheDocument();
    expect(screen.getByText("Abadan Refinery")).toBeInTheDocument();
    expect(screen.queryByText("Ruwais Refinery")).not.toBeInTheDocument();
  });

  it("explains an empty result instead of showing a bare header", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "Filter rows" }), "zzz");

    expect(screen.getByText(/NO ROWS MATCH/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("selects an asset when its row is clicked", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    await user.click(screen.getByText("Abadan Refinery"));

    expect(props.onSelectAsset).toHaveBeenCalledWith(abadan);
  });

  it("says so when every layer is off", () => {
    renderPage({ activeDatasets: [], focusedDataset: null, visibleAssets: [] });

    expect(screen.getByText(/NO LAYERS ARE SWITCHED ON/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
