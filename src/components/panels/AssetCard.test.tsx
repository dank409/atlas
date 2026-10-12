import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetCard } from "./AssetCard";
import { makeField, makePipeline, makeRefinery, makeTerminal } from "../../test/fixtures";
import type { InfrastructureAsset } from "../../types/Infrastructure";

function renderCard(asset: InfrastructureAsset, overrides: Partial<Parameters<typeof AssetCard>[0]> = {}) {
  const props = {
    asset,
    onClear: vi.fn(),
    onOpenCountry: vi.fn(),
    ...overrides
  };

  render(<AssetCard {...props} />);
  return props;
}

function valueOf(label: string) {
  return within(screen.getByText(label).closest("div") as HTMLElement).getByRole("definition").textContent;
}

describe("AssetCard", () => {
  it("shows a refinery's fields, energy type, source and download date", () => {
    renderCard(makeRefinery());

    expect(screen.getByText("REFINERY")).toBeInTheDocument();
    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();
    expect(valueOf("Energy")).toBe("CRUDE OIL");
    expect(valueOf("Country")).toBe("United Arab Emirates ▸");
    expect(valueOf("Capacity")).toBe("837,000 BPD");
    expect(valueOf("Operator")).toBe("ADNOC Refining");
    expect(valueOf("Lat / lon")).toBe("24.110, 52.730");
    expect(screen.getByText("SOURCE: Test source · 2025-03-28")).toBeInTheDocument();
  });

  it("shows no status for a refinery, because its source has none", () => {
    renderCard(makeRefinery());

    expect(screen.queryByText(/Status/)).not.toBeInTheDocument();
  });

  it("shows the source's status for the other layers", () => {
    renderCard(makePipeline({ status: "proposed" }));

    expect(valueOf("Status")).toBe("PROPOSED");
  });

  it("shows pipeline-specific fields with BOE/D capacity", () => {
    renderCard(makePipeline({ diameter_inches: 48, endPoint: "Yanbu", segmentName: "Pipeline 2", startPoint: "Abqaiq" }));

    expect(valueOf("Segment")).toBe("Pipeline 2");
    expect(valueOf("Energy")).toBe("CRUDE OIL");
    expect(valueOf("Capacity")).toBe("5,000,000 BOE/D");
    expect(valueOf("Length")).toBe("1,200 KM");
    expect(valueOf("Diameter")).toBe("48 IN");
    expect(valueOf("Route")).toBe("Abqaiq → Yanbu");
  });

  it("shows -- for values the source does not report", () => {
    renderCard(makeField({ basin: null, operator: null, production_bpd: undefined }));

    expect(valueOf("Production")).toBe("--");
    expect(valueOf("Country")).toBe("Saudi Arabia ▸");
    expect(valueOf("Operator")).toBe("--");
    expect(valueOf("Basin")).toBe("--");
  });

  it("gives field production in barrels of oil equivalent", () => {
    renderCard(makeField());

    expect(valueOf("Production")).toBe("1,700,000 BOE/D");
  });

  it("shows an LNG terminal's role and capacity", () => {
    renderCard(makeTerminal());

    expect(screen.getByText("LNG TERMINAL")).toBeInTheDocument();
    expect(valueOf("Energy")).toBe("NATURAL GAS / LNG");
    expect(valueOf("Role")).toBe("LNG EXPORT");
    expect(valueOf("Capacity")).toBe("64.0 MTPA");
  });

  it("links the country row, and the operator row when the operator has an entry", async () => {
    const user = userEvent.setup();
    const props = renderCard(makeRefinery(), { onOpenOperator: vi.fn() });

    await user.click(screen.getByRole("button", { name: /United Arab Emirates/ }));
    await user.click(screen.getByRole("button", { name: /ADNOC Refining/ }));

    expect(props.onOpenCountry).toHaveBeenCalledTimes(1);
    expect(props.onOpenOperator).toHaveBeenCalledTimes(1);
  });

  it("links a pipeline's owner and a field's operator, the names the operator index uses", () => {
    const { unmount } = render(
      <AssetCard asset={makePipeline()} onClear={vi.fn()} onOpenCountry={vi.fn()} onOpenOperator={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /Saudi Aramco/ })).toBeInTheDocument();
    unmount();

    render(<AssetCard asset={makeField()} onClear={vi.fn()} onOpenCountry={vi.fn()} onOpenOperator={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Saudi Aramco/ })).toBeInTheDocument();
  });

  it("links a terminal's operator when it has one, and its owner otherwise", () => {
    const { unmount } = render(
      <AssetCard asset={makeTerminal()} onClear={vi.fn()} onOpenCountry={vi.fn()} onOpenOperator={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /QatarEnergy LNG/ })).toBeInTheDocument();
    expect(valueOf("Owner")).toBe("QatarEnergy");
    unmount();

    render(
      <AssetCard
        asset={makeTerminal({ operator: null })}
        onClear={vi.fn()}
        onOpenCountry={vi.fn()}
        onOpenOperator={vi.fn()}
      />
    );
    expect(valueOf("Owner")).toBe("QatarEnergy ▸");
    expect(valueOf("Operator")).toBe("--");
  });

  it("offers SHOW ON MAP only when asked to", async () => {
    const user = userEvent.setup();
    const onShowOnMap = vi.fn();

    renderCard(makeRefinery(), { onShowOnMap });
    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    expect(onShowOnMap).toHaveBeenCalledTimes(1);
  });

  it("leaves the operator as plain text when it has no entry to open", async () => {
    const user = userEvent.setup();
    const props = renderCard(makeRefinery());

    // Clear + the country link; the operator row is not a button.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(valueOf("Operator")).toBe("ADNOC Refining");
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
