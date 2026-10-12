import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReferenceTable, type ReferenceColumn } from "./ReferenceTable";

interface Row {
  assets: number;
  id: string;
  name: string;
}

const ROWS: Row[] = [
  { assets: 20, id: "oq", name: "OQGN" },
  { assets: 87, id: "aramco", name: "Saudi Aramco" },
  { assets: 0, id: "bp", name: "BP" }
];

const COLUMNS: ReferenceColumn<Row>[] = [
  { getValue: (row) => row.name, header: "OPERATOR", id: "name" },
  {
    format: (row) => (row.assets > 0 ? `${row.assets} ASSETS` : "--"),
    getValue: (row) => row.assets,
    header: "ASSETS",
    id: "assets",
    isNumeric: true
  }
];

function renderTable() {
  const onSelect = vi.fn();

  render(
    <ReferenceTable
      ariaLabel="Operators"
      columns={COLUMNS}
      getRowId={(row: Row) => row.id}
      initialSort={{ columnId: "assets", isDescending: true }}
      onSelect={onSelect}
      rows={ROWS}
      selectedId="oq"
    />
  );
  return { onSelect };
}

function names() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
}

describe("ReferenceTable", () => {
  it("opens in the given sort order and shows formatted values", () => {
    renderTable();

    expect(names()).toEqual(["Saudi Aramco", "OQGN", "BP"]);
    expect(screen.getByText("87 ASSETS")).toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("reverses a column on a second click", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "SORT BY ASSETS" }));

    expect(names()).toEqual(["BP", "OQGN", "Saudi Aramco"]);
  });

  it("sorts names A to Z and numbers largest-first when switching column", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "SORT BY OPERATOR" }));
    expect(names()).toEqual(["BP", "OQGN", "Saudi Aramco"]);

    await user.click(screen.getByRole("button", { name: "SORT BY ASSETS" }));
    expect(names()).toEqual(["Saudi Aramco", "OQGN", "BP"]);
  });

  it("marks the selected row and reports a pick from the name or anywhere on the row", async () => {
    const user = userEvent.setup();
    const props = renderTable();

    expect(screen.getByText("OQGN").closest("tr")).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Saudi Aramco" }));
    await user.click(screen.getByText("87 ASSETS"));

    expect(props.onSelect.mock.calls).toEqual([["aramco"], ["aramco"]]);
  });
});
