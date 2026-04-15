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
  classification: "medium-sour",
  pricingRef: "OSP vs ASCI",
  productionMbpd: 5.9,
  note: "Saudi Aramco flagship."
};

const murban: CrudeGrade = {
  id: "murban",
  name: "Murban",
  producer: "United Arab Emirates",
  producerIso: "ARE",
  apiGravity: 40.2,
  sulfurPct: 0.78,
  classification: "light-sour",
  pricingRef: "IFAD Murban Futures",
  productionMbpd: 1.7,
  note: "ADNOC onshore futures-deliverable grade."
};

const basrahHeavy: CrudeGrade = {
  id: "basrah-heavy",
  name: "Basrah Heavy",
  producer: "Iraq",
  producerIso: "IRQ",
  apiGravity: 23.7,
  sulfurPct: 4.1,
  classification: "heavy-sour",
  pricingRef: "SOMO OSP vs ASCI",
  productionMbpd: 0.6,
  note: "High-sulfur heavy stream priced deeply discounted."
};

const snapshot: CrudeGradeSnapshot = {
  mode: "STATIC_SNAPSHOT",
  asOf: "2026-04-15",
  source: "Curated",
  grades: [arabLight, murban, basrahHeavy]
};

describe("CrudeGradeTable", () => {
  it("renders the 5-column essentials set (name, api, sulfur, class, prod)", () => {
    // Columns were pared from 7 → 5: PRICING REF + NOTE moved into
    // the GradeDetailOverlay drill-down. Sort buttons double as
    // header labels.
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} />);

    expect(screen.getByRole("button", { name: "SORT BY NAME" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY API" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SORT BY SULFUR" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "SORT BY CLASSIFICATION" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "SORT BY PRODUCTION" })
    ).toBeInTheDocument();

    // De-scoped columns now live in the overlay, not the grid.
    expect(
      screen.queryByRole("button", { name: "SORT BY PRICING REFERENCE" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "SORT BY NOTE" })
    ).not.toBeInTheDocument();
  });

  it("renders a row for every grade with producer subtitle", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} />);

    expect(screen.getByText("Arab Light")).toBeInTheDocument();
    expect(screen.getByText("Murban")).toBeInTheDocument();
    expect(screen.getByText("Basrah Heavy")).toBeInTheDocument();
    expect(screen.getByText("SAUDI ARABIA")).toBeInTheDocument();
    expect(screen.getByText("UNITED ARAB EMIRATES")).toBeInTheDocument();
    expect(screen.getByText("IRAQ")).toBeInTheDocument();
  });

  it("routes row clicks through onInspectGrade when provided", () => {
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

  it("renders the classification badge with a data-tone matching the classification", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} />);

    const mediumSour = screen.getByText("medium sour");
    expect(mediumSour).toHaveAttribute("data-tone", "medium-sour");

    const heavySour = screen.getByText("heavy sour");
    expect(heavySour).toHaveAttribute("data-tone", "heavy-sour");

    const lightSour = screen.getByText("light sour");
    expect(lightSour).toHaveAttribute("data-tone", "light-sour");
  });

  it("defaults to API° descending sort (Murban > Arab Light > Basrah Heavy)", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} />);

    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(within(rows[0]).getByText("Murban")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Arab Light")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Basrah Heavy")).toBeInTheDocument();
  });

  it("flips the API° sort direction when the user clicks the header twice", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} />);

    // Default is desc — clicking once toggles to asc (Basrah first).
    fireEvent.click(screen.getByRole("button", { name: "SORT BY API" }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Basrah Heavy")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Arab Light")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Murban")).toBeInTheDocument();
  });

  it("surfaces the snapshot mode and source attribution in the meta row", () => {
    render(<CrudeGradeTable snapshot={snapshot} isLoading={false} error={null} />);

    expect(screen.getByText("STATIC_SNAPSHOT")).toBeInTheDocument();
    expect(screen.getByText(/SOURCE: Curated/)).toBeInTheDocument();
    expect(screen.getByText("GRADES: 3")).toBeInTheDocument();
    expect(screen.getByText("PRODUCERS: 3")).toBeInTheDocument();
  });

  it("renders a loading placeholder when snapshot is null and loading", () => {
    render(<CrudeGradeTable snapshot={null} isLoading={true} error={null} />);
    expect(screen.getByText(/LOADING CRUDE GRADES/)).toBeInTheDocument();
  });

  it("renders an error state when load fails", () => {
    render(
      <CrudeGradeTable
        snapshot={null}
        isLoading={false}
        error={new Error("fetch 404")}
      />
    );
    expect(screen.getByText(/LOAD FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/fetch 404/)).toBeInTheDocument();
  });
});
