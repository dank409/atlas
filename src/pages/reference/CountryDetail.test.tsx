import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CountryDetail } from "./CountryDetail";
import { makeField, makeRefinery } from "../../test/fixtures";
import type { CrudeGrade } from "../../types/CrudeGrade";
import type { CountryEntry, OperatorEntry } from "../../utils/referenceIndex";

const rasTanura = makeRefinery({
  capacity_bpd: 550000,
  country: "SA",
  countryName: "Saudi Arabia",
  id: "ras-tanura",
  name: "Ras Tanura Refinery"
});
const safaniya = makeField({ id: "safaniya", name: "Safaniya Oil and Gas Field (Saudi Arabia)" });

const SAUDI: CountryEntry = {
  assets: [rasTanura, safaniya],
  code: "SA",
  name: "Saudi Arabia",
  operatorIds: ["saudi-aramco"],
  profile: {
    code: "SA",
    exportRoutes: "Most crude is loaded at Ras Tanura.",
    keyExportTerminals: ["Ras Tanura", "Yanbu"],
    name: "Saudi Arabia",
    source: "EIA brief",
    summary: "Offshore fields such as Safaniya feed refineries on both coasts.",
    updated: "2026-10-10"
  },
  refiningCapacityBpd: 550000
};
const ARAMCO: OperatorEntry = {
  assets: [rasTanura, safaniya, makeRefinery({ country: "US", id: "motiva" })],
  countryCodes: ["SA", "US"],
  id: "saudi-aramco",
  name: "Saudi Aramco",
  pipelineLengthKm: 0,
  profile: null,
  refiningCapacityBpd: 550000
};
const ARAB_LIGHT = { id: "arab-light", name: "Arab Light" } as CrudeGrade;

type DataProps = Pick<Parameters<typeof CountryDetail>[0], "country" | "grades" | "operators">;

function renderDetail(overrides: Partial<DataProps> = {}) {
  // Kept out of `overrides` so they stay typed as mocks.
  const handlers = { onNavigate: vi.fn(), onSelectAsset: vi.fn(), onShowOnMap: vi.fn() };

  render(
    <CountryDetail
      country={SAUDI}
      grades={[ARAB_LIGHT]}
      ignoredMentionNames={["Saudi Arabia"]}
      operators={[ARAMCO]}
      {...overrides}
      {...handlers}
    />
  );
  return handlers;
}

function section(title: RegExp) {
  return screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;
}

describe("CountryDetail", () => {
  it("leads with counts taken from the map data", () => {
    renderDetail();

    expect(screen.getByText("1 · 550,000 BPD")).toBeInTheDocument();
    expect(screen.getByText("SOURCES: GLOBAL ENERGY MONITOR · EDF OGIM · OPENSTREETMAP · EIA brief")).toBeInTheDocument();
  });

  it("offers to show the country on the map", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    expect(props.onShowOnMap).toHaveBeenCalledTimes(1);
  });

  it("shows the background note", () => {
    renderDetail();

    const background = section(/BACKGROUND/);

    expect(within(background).getByText(/Offshore fields such as Safaniya/)).toBeInTheDocument();
    expect(within(background).getByText("Ras Tanura · Yanbu")).toBeInTheDocument();
  });

  it("links the assets the note names to the map", async () => {
    const user = userEvent.setup();
    const props = renderDetail();
    const named = section(/NAMED IN THE NOTE/);

    expect(within(named).getAllByRole("listitem")).toHaveLength(2);
    await user.click(within(named).getByRole("button", { name: /Safaniya/ }));

    expect(props.onSelectAsset).toHaveBeenCalledWith(safaniya);
  });

  it("links to the country's crude grades and operators", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: "Arab Light" }));
    // The count beside an operator is its assets in this country, not overall.
    await user.click(screen.getByRole("button", { name: "Saudi Aramco (2)" }));

    expect(props.onNavigate.mock.calls).toEqual([
      ["grades", "arab-light"],
      ["operators", "saudi-aramco"]
    ]);
  });

  it("lists the country's assets by layer", () => {
    renderDetail();

    expect(within(section(/REFINERIES ON THE MAP \(1\)/)).getByText("550,000 BPD")).toBeInTheDocument();
    expect(section(/OIL & GAS FIELDS ON THE MAP \(1\)/)).toBeInTheDocument();
  });

  it("copes with a country that has no note, grades, operators or refineries", () => {
    renderDetail({
      country: { ...SAUDI, assets: [], operatorIds: [], profile: null, refiningCapacityBpd: 0 },
      grades: [],
      operators: []
    });

    expect(screen.getByText("No background note has been written for this country.")).toBeInTheDocument();
    expect(screen.getByText("None in the crude grade table.")).toBeInTheDocument();
    expect(screen.getByText("No named operators in the map data.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in the datasets used for this map.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /NAMED IN THE NOTE/ })).not.toBeInTheDocument();
  });
});
