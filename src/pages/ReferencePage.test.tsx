import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReferencePage } from "./ReferencePage";
import { makeField, makePipeline, makeRefinery } from "../test/fixtures";
import type { ReferenceLocation } from "../types/View";
import { buildCountryIndex, buildOperatorIndex } from "../utils/referenceIndex";

const safaniya = makeField({ id: "safaniya", name: "Safaniya Oil and Gas Field (Saudi Arabia)" });
const eastWest = makePipeline();
const ruwais = makeRefinery();
const ASSETS = [safaniya, eastWest, ruwais];

const { operatorIdByAssetId, operators } = buildOperatorIndex(ASSETS, [], []);
const countries = buildCountryIndex(
  ASSETS,
  [
    {
      code: "SA",
      exportRoutes: "Via the East-West pipeline.",
      name: "Saudi Arabia",
      source: "EIA",
      summary: "Largest OPEC producer.",
      updated: "2026-10-10"
    }
  ],
  operatorIdByAssetId
);

function grade(id: string, name: string, apiGravity: number, producer: string, note: string) {
  return { apiGravity, id, name, note, producer, producerIso: "XXX", source: "Wikipedia", sulfurPct: 2.9 };
}

const GRADE_SNAPSHOT = {
  // Deliberately not in table order: the lightest grade is last.
  grades: [
    grade("arab-heavy", "Arab Heavy", 27.4, "Saudi Arabia", "From Safaniya."),
    grade("arab-light", "Arab Light", 33.4, "Saudi Arabia", "Flagship grade."),
    grade("murban", "Murban", 40.2, "United Arab Emirates", "Onshore grade.")
  ],
  source: "EIA, Wikipedia"
};

function renderPage(location: ReferenceLocation = { selectedIdByTab: {}, tab: "countries" }) {
  const props = {
    countries,
    crudeGrades: { error: null, isLoading: false, snapshot: GRADE_SNAPSHOT },
    location,
    onNavigate: vi.fn(),
    onOpenTable: vi.fn(),
    onSelectAsset: vi.fn(),
    onShowOnMap: vi.fn(),
    operators
  };

  render(<ReferencePage {...props} />);
  return props;
}

describe("ReferencePage", () => {
  it("lists every country on the map and opens the first one beside the list", () => {
    renderPage();

    const table = screen.getByRole("table", { name: "Countries" });

    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "COUNTRY Saudi Arabia" })).toBeInTheDocument();
    expect(screen.getByText(/COUNTS FROM THE MAP DATA/)).toBeInTheDocument();
  });

  it("shows the country the location points at, with its grades", () => {
    renderPage({ selectedIdByTab: { countries: "AE" }, tab: "countries" });

    const card = screen.getByRole("region", { name: "COUNTRY United Arab Emirates" });

    expect(within(card).getByRole("button", { name: "Murban" })).toBeInTheDocument();
    expect(within(card).getByText("No background note has been written for this country.")).toBeInTheDocument();
  });

  it("asks to navigate when a row, a tab or a cross-link is clicked", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    await user.click(screen.getByRole("button", { name: "United Arab Emirates" }));
    await user.click(screen.getByRole("tab", { name: "OPERATORS" }));
    await user.click(screen.getByRole("button", { name: "Saudi Aramco (2)" }));

    expect(props.onNavigate.mock.calls).toEqual([["countries", "AE"], ["operators"], ["operators", "saudi-aramco"]]);
  });

  it("lists operators grouped from the map data, biggest first, and filters them by name", async () => {
    const user = userEvent.setup();
    renderPage({ selectedIdByTab: {}, tab: "operators" });

    expect(screen.getByRole("region", { name: "OPERATOR Saudi Aramco" })).toBeInTheDocument();
    expect(screen.getByText("GROUPED BY NAME FROM THE MAP DATA")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Filter operators" }), "adnoc");

    const table = screen.getByRole("table", { name: "Operators" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("button", { name: "ADNOC Refining" })).toBeInTheDocument();
  });

  it("asks for the map filtered to the open country or operator", async () => {
    const user = userEvent.setup();
    const props = renderPage({ selectedIdByTab: { countries: "SA" }, tab: "countries" });

    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    expect(props.onShowOnMap).toHaveBeenCalledWith({ countryCode: "SA" });
  });

  it("sends an asset picked from an entry to the map", async () => {
    const user = userEvent.setup();
    const props = renderPage({ selectedIdByTab: {}, tab: "operators" });

    await user.click(screen.getByRole("button", { name: /East-West Crude Oil Pipeline/ }));

    expect(props.onSelectAsset).toHaveBeenCalledWith(eastWest);
  });

  it("opens crude grades on the table's top row, with the table's sources", () => {
    renderPage({ selectedIdByTab: {}, tab: "grades" });

    expect(screen.getByRole("region", { name: "CRUDE GRADE Murban" })).toBeInTheDocument();
    expect(screen.getByText("SOURCES: EIA, Wikipedia")).toBeInTheDocument();
    expect(screen.queryByText(/FROM THE MAP DATA/)).not.toBeInTheDocument();
  });

  it("links a grade to its country and to the map assets its note names", async () => {
    const user = userEvent.setup();
    const props = renderPage({ selectedIdByTab: { grades: "arab-heavy" }, tab: "grades" });
    const card = screen.getByRole("region", { name: "CRUDE GRADE Arab Heavy" });

    await user.click(within(card).getByRole("button", { name: "Saudi Arabia ▸" }));
    await user.click(within(card).getByRole("button", { name: /Safaniya/ }));
    await user.click(within(card).getByRole("button", { name: "Arab Light" }));

    expect(props.onNavigate.mock.calls).toEqual([
      ["countries", "SA"],
      ["grades", "arab-light"]
    ]);
    expect(props.onSelectAsset).toHaveBeenCalledWith(safaniya);
  });

  it("shows the glossary with the linked term outlined", () => {
    renderPage({ selectedIdByTab: { glossary: "API gravity" }, tab: "glossary" });

    expect((screen.getByText("API gravity").closest("div") as HTMLElement).className).toMatch(/entryHighlighted/);
  });

  it("passes glossary links through to the table and other tabs", async () => {
    const user = userEvent.setup();
    const props = renderPage({ selectedIdByTab: {}, tab: "glossary" });

    // Both "BPD" and "Refinery" point at the refinery table.
    await user.click(screen.getAllByRole("button", { name: /REFINERIES IN THE TABLE/ })[0]);

    expect(props.onOpenTable).toHaveBeenCalledWith("refineries");
  });
});
