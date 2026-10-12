import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrudeGradeTable } from "./CrudeGradeTable";
import type { CrudeGrade, CrudeGradeSnapshot } from "../../types/CrudeGrade";

const arabLight: CrudeGrade = {
  id: "arab-light",
  name: "Arab Light",
  producer: "Saudi Arabia",
  producerIso: "SAU",
  apiGravity: 33.4,
  sulfurPct: 1.8,
  note: "Saudi Aramco flagship.",
  source: "Wikipedia"
};

const murban: CrudeGrade = {
  id: "murban",
  name: "Murban",
  producer: "United Arab Emirates",
  producerIso: "ARE",
  apiGravity: 40.2,
  sulfurPct: 0.78,
  note: "ADNOC onshore grade.",
  source: "EIA"
};

const basrahHeavy: CrudeGrade = {
  id: "basrah-heavy",
  name: "Basrah Heavy",
  producer: "Iraq",
  producerIso: "IRQ",
  apiGravity: 23.7,
  sulfurPct: 4.1,
  note: "High-sulfur heavy stream.",
  source: "S&P Global"
};

const snapshot: CrudeGradeSnapshot = {
  source: "EIA, Wikipedia",
  grades: [arabLight, murban, basrahHeavy]
};

describe("CrudeGradeTable", () => {
  it("shows only the name and the two sourced figures, leaving the prose to the detail card", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} onInspectGrade={vi.fn()} />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "NAME·",
      "API°▼",
      "SULFUR %·"
    ]);
    expect(screen.getByRole("button", { name: "SORT BY NAME" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY API" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY SULFUR" })).toBeInTheDocument();
  });

  it("renders a row for every grade with producer subtitle", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} onInspectGrade={vi.fn()} />);

    expect(screen.getByText("Arab Light")).toBeInTheDocument();
    expect(screen.getByText("Murban")).toBeInTheDocument();
    expect(screen.getByText("Basrah Heavy")).toBeInTheDocument();
    expect(screen.getByText("SAUDI ARABIA")).toBeInTheDocument();
    expect(screen.getByText("UNITED ARAB EMIRATES")).toBeInTheDocument();
    expect(screen.getByText("IRAQ")).toBeInTheDocument();
  });

  it("routes row clicks through onInspectGrade", () => {
    const onInspect = vi.fn();
    render(
      <CrudeGradeTable
        snapshot={snapshot}
        isLoading={false}
        error={null}
        onInspectGrade={onInspect}
      />
    );

    const arabLightRow = screen.getByText("Arab Light").closest("tr")!;
    fireEvent.click(arabLightRow);

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "arab-light" })
    );
  });

  it("marks the selected grade's row", () => {
    render(
      <CrudeGradeTable
        snapshot={snapshot}
        isLoading={false}
        error={null}
        onInspectGrade={vi.fn()}
        selectedGradeId="murban"
      />
    );

    expect(screen.getByText("Murban").closest("tr")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Arab Light").closest("tr")).toHaveAttribute("aria-selected", "false");
  });

  it("defaults to API° descending sort (Murban > Arab Light > Basrah Heavy)", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} onInspectGrade={vi.fn()} />);

    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(within(rows[0]).getByText("Murban")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Arab Light")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Basrah Heavy")).toBeInTheDocument();
  });

  it("flips the API° sort direction when the user clicks the header twice", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} onInspectGrade={vi.fn()} />);

    // Default is desc — clicking once toggles to asc (Basrah first).
    fireEvent.click(screen.getByRole("button", { name: "SORT BY API" }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Basrah Heavy")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Arab Light")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Murban")).toBeInTheDocument();
  });

  it("shows the table's source attribution and counts", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} onInspectGrade={vi.fn()} />);

    expect(screen.getByText("SOURCES: EIA, Wikipedia")).toBeInTheDocument();
    expect(screen.getByText("GRADES: 3")).toBeInTheDocument();
    expect(screen.getByText("PRODUCERS: 3")).toBeInTheDocument();
  });

  it("renders a loading placeholder when snapshot is null and loading", () => {
    render(<CrudeGradeTable snapshot={null} isLoading={true} error={null} onInspectGrade={vi.fn()} />);
    expect(screen.getByText(/LOADING CRUDE GRADES/)).toBeInTheDocument();
  });

  it("renders an error state when load fails", () => {
    render(
      <CrudeGradeTable
        snapshot={null}
        isLoading={false}
        error={new Error("fetch 404")}
        onInspectGrade={vi.fn()}
      />
    );
    expect(screen.getByText(/LOAD FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/fetch 404/)).toBeInTheDocument();
  });
});
