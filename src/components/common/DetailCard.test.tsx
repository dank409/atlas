import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DetailCard } from "./DetailCard";

describe("DetailCard", () => {
  it("renders the identity, rows and footer in a labelled region", () => {
    render(
      <DetailCard
        footer="SOURCE: TEST"
        kind="COUNTRY"
        name="Oman"
        rows={[
          { label: "ISO", value: "OM" },
          { isProse: true, label: "Summary", value: "East of the Strait of Hormuz." }
        ]}
      />
    );

    const card = screen.getByRole("region", { name: "COUNTRY Oman" });

    expect(within(card).getByText("OM")).toBeInTheDocument();
    expect(within(card).getByText("East of the Strait of Hormuz.")).toBeInTheDocument();
    expect(within(card).getByText("SOURCE: TEST")).toBeInTheDocument();
  });

  it("renders extra sections under the rows", () => {
    render(
      <DetailCard footer="x" kind="COUNTRY" name="Oman" rows={[{ label: "ISO", value: "OM" }]}>
        <div>EXTRA SECTION</div>
      </DetailCard>
    );

    expect(within(screen.getByRole("region", { name: "COUNTRY Oman" })).getByText("EXTRA SECTION")).toBeInTheDocument();
  });

  it("renders no buttons unless it is given something to do", () => {
    render(<DetailCard footer="x" kind="COUNTRY" name="Oman" rows={[{ label: "ISO", value: "OM" }]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("wires up the close, back, action and row-link buttons", async () => {
    const user = userEvent.setup();
    const handlers = { action: vi.fn(), back: vi.fn(), close: vi.fn(), row: vi.fn() };

    render(
      <DetailCard
        action={{ label: "SHOW ON MAP", onClick: handlers.action }}
        back={{ label: "RUWAIS REFINERY", onClick: handlers.back }}
        closeLabel="Clear selection"
        footer="x"
        kind="REFINERY"
        name="Ruwais"
        onClose={handlers.close}
        rows={[{ label: "Country", onClick: handlers.row, value: "UAE" }]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    await user.click(screen.getByRole("button", { name: /RUWAIS REFINERY/ }));
    await user.click(screen.getByRole("button", { name: "SHOW ON MAP" }));
    await user.click(screen.getByRole("button", { name: /UAE/ }));

    expect(handlers.close).toHaveBeenCalledTimes(1);
    expect(handlers.back).toHaveBeenCalledTimes(1);
    expect(handlers.action).toHaveBeenCalledTimes(1);
    expect(handlers.row).toHaveBeenCalledTimes(1);
  });
});
