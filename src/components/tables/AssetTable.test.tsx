import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetTable } from "./AssetTable";
import { makeField, makePipeline, makeRefinery, makeTerminal } from "../../test/fixtures";

const ruwais = makeRefinery();
const abadan = makeRefinery({
  capacity_bpd: 400000,
  countryName: "Iran",
  id: "refinery-abadan",
  name: "Abadan Refinery",
  operator: "NIOC"
});
const aden = makeRefinery({
  capacity_bpd: undefined,
  countryName: "Yemen",
  id: "refinery-aden",
  name: "Little Aden Refinery",
  operator: ""
});
const REFINERIES = [ruwais, abadan, aden];

function headers() {
  return screen.getAllByRole("columnheader").map((header) => header.textContent?.replace(/[▲▼·]/g, "").trim());
}

function rowNames() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
}

function cellsOf(name: string) {
  return within(screen.getByText(name).closest("tr") as HTMLElement)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

describe("AssetTable", () => {
  it("shows refineries with operator and no status column", () => {
    render(<AssetTable assets={REFINERIES} datasetId="refineries" onSelectAsset={vi.fn()} selectedAssetId={null} />);

    expect(headers()).toEqual(["NAME", "COUNTRY", "CAPACITY", "OPERATOR"]);
    expect(cellsOf("Ruwais Refinery")).toEqual([
      "Ruwais Refinery",
      "United Arab Emirates",
      "837,000 BPD",
      "ADNOC Refining"
    ]);
  });

  it("shows -- for values the source does not report", () => {
    render(<AssetTable assets={REFINERIES} datasetId="refineries" onSelectAsset={vi.fn()} selectedAssetId={null} />);

    expect(cellsOf("Little Aden Refinery")).toEqual(["Little Aden Refinery", "Yemen", "--", "--"]);
  });

  it("gives pipelines their own columns", () => {
    render(
      <AssetTable
        assets={[makePipeline({ segmentName: "Pipeline 2", status: "proposed" })]}
        datasetId="pipelines"
        onSelectAsset={vi.fn()}
        selectedAssetId={null}
      />
    );

    expect(headers()).toEqual(["NAME", "COUNTRY", "CARRIES", "LENGTH", "CAPACITY", "OWNER", "STATUS"]);
    expect(cellsOf("East-West Crude Oil Pipeline · Pipeline 2")).toEqual([
      "East-West Crude Oil Pipeline · Pipeline 2",
      "Saudi Arabia",
      "Crude oil",
      "1,200 KM",
      "5,000,000 BOE/D",
      "Saudi Aramco",
      "PROPOSED"
    ]);
  });

  it("gives fields and LNG terminals their own columns", () => {
    const { unmount } = render(
      <AssetTable assets={[makeField()]} datasetId="fields" onSelectAsset={vi.fn()} selectedAssetId={null} />
    );

    expect(headers()).toEqual(["NAME", "COUNTRY", "TYPE", "PRODUCTION", "OPERATOR", "STATUS"]);
    unmount();

    render(<AssetTable assets={[makeTerminal()]} datasetId="terminals" onSelectAsset={vi.fn()} selectedAssetId={null} />);

    expect(headers()).toEqual(["NAME", "COUNTRY", "ROLE", "CAPACITY", "OPERATOR / OWNER", "STATUS"]);
    expect(cellsOf("Ras Laffan LNG Terminal")).toContain("EXPORT");
  });

  it("sorts by name ascending by default", () => {
    render(<AssetTable assets={REFINERIES} datasetId="refineries" onSelectAsset={vi.fn()} selectedAssetId={null} />);

    expect(rowNames()).toEqual(["Abadan Refinery", "Little Aden Refinery", "Ruwais Refinery"]);
  });

  it("sorts the metric column largest-first on the first click, then reverses", async () => {
    const user = userEvent.setup();

    render(<AssetTable assets={REFINERIES} datasetId="refineries" onSelectAsset={vi.fn()} selectedAssetId={null} />);

    await user.click(screen.getByRole("button", { name: "SORT BY CAPACITY" }));
    expect(rowNames()).toEqual(["Ruwais Refinery", "Abadan Refinery", "Little Aden Refinery"]);

    await user.click(screen.getByRole("button", { name: "SORT BY CAPACITY" }));
    expect(rowNames()).toEqual(["Little Aden Refinery", "Abadan Refinery", "Ruwais Refinery"]);
  });

  it("selects an asset when its row is clicked and marks the selected row", async () => {
    const user = userEvent.setup();
    const onSelectAsset = vi.fn();

    render(
      <AssetTable assets={REFINERIES} datasetId="refineries" onSelectAsset={onSelectAsset} selectedAssetId={ruwais.id} />
    );

    await user.click(screen.getByText("Abadan Refinery"));

    expect(onSelectAsset).toHaveBeenCalledWith(abadan);
    expect(screen.getByText("Ruwais Refinery").closest("tr")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Abadan Refinery").closest("tr")).toHaveAttribute("aria-selected", "false");
  });
});
