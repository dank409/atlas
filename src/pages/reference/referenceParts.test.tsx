import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetGroups, AssetLinkList, DetailSection, LinkChips } from "./referenceParts";
import { makeField, makePipeline, makeRefinery } from "../../test/fixtures";

function refineries(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeRefinery({ capacity_bpd: (index + 1) * 1000, id: `r${index}`, name: `Refinery ${index}` })
  );
}

function linkNames() {
  return screen.getAllByRole("listitem").map((item) => item.textContent);
}

describe("DetailSection", () => {
  it("renders a titled section", () => {
    render(
      <DetailSection title="BACKGROUND">
        <p>Body</p>
      </DetailSection>
    );

    expect(screen.getByRole("heading", { name: "BACKGROUND" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});

describe("LinkChips", () => {
  it("renders one link per chip", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<LinkChips chips={[{ id: "murban", label: "Murban", onClick }]} emptyText="None" />);
    await user.click(screen.getByRole("button", { name: "Murban" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("says so when there is nothing to link to", () => {
    render(<LinkChips chips={[]} emptyText="None in the crude grade table." />);

    expect(screen.getByText("None in the crude grade table.")).toBeInTheDocument();
  });
});

describe("AssetLinkList", () => {
  it("shows each asset's name and headline figure and selects it on click", async () => {
    const user = userEvent.setup();
    const onSelectAsset = vi.fn();
    const ruwais = makeRefinery();

    render(<AssetLinkList assets={[ruwais]} onSelectAsset={onSelectAsset} />);
    await user.click(screen.getByRole("button", { name: /Ruwais Refinery/ }));

    expect(screen.getByText("837,000 BPD")).toBeInTheDocument();
    expect(onSelectAsset).toHaveBeenCalledWith(ruwais);
  });

  it("shows the asset type instead for lists that mix layers", () => {
    render(<AssetLinkList assets={[makePipeline({ segmentName: "Main" })]} onSelectAsset={vi.fn()} showType />);

    expect(screen.getByRole("button")).toHaveTextContent("East-West Crude Oil Pipeline · Main");
    expect(screen.getByText("PIPELINE")).toBeInTheDocument();
  });

  it("shows the first few and expands in place", async () => {
    const user = userEvent.setup();

    render(<AssetLinkList assets={refineries(7)} limit={5} onSelectAsset={vi.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "SHOW ALL 7" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);

    await user.click(screen.getByRole("button", { name: "SHOW FEWER" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("offers no toggle when everything already fits", () => {
    render(<AssetLinkList assets={refineries(5)} limit={5} onSelectAsset={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /SHOW/ })).not.toBeInTheDocument();
  });
});

describe("AssetGroups", () => {
  it("makes one section per layer that has assets, largest asset first", () => {
    render(<AssetGroups assets={[...refineries(2), makeField()]} onSelectAsset={vi.fn()} />);

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "REFINERIES ON THE MAP (2)",
      "OIL & GAS FIELDS ON THE MAP (1)"
    ]);
    expect(linkNames()[0]).toContain("Refinery 1");
  });

  it("says so when the entry has nothing on the map", () => {
    render(<AssetGroups assets={[]} onSelectAsset={vi.fn()} />);

    expect(screen.getByText("Nothing in the datasets used for this map.")).toBeInTheDocument();
  });
});
