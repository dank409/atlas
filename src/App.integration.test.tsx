import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCatalog, makeField, makePipeline, makeRefinery, makeTerminal } from "./test/fixtures";
import type { CountryProfile, InfrastructureAsset } from "./types/Infrastructure";

const ruwais = makeRefinery();
const alexandria = makeRefinery({
  capacity_bpd: 100000,
  country: "EG",
  countryName: "Egypt",
  id: "refinery-alexandria",
  name: "Alexandria Refinery",
  operator: "Alexandria Petroleum"
});
const eastWest = makePipeline();
const gasLine = makePipeline({ hydrocarbon: "natural_gas", id: "pipeline-gas", name: "Dolphin Gas Pipeline" });
const ghawar = makeField();
const rasLaffan = makeTerminal();
const ASSETS: InfrastructureAsset[] = [ruwais, alexandria, eastWest, gasLine, ghawar, rasLaffan];

const UAE: CountryProfile = {
  code: "AE",
  exportRoutes: "Piped from Habshan to Fujairah.",
  name: "United Arab Emirates",
  source: "EIA",
  summary: "ADNOC-dominant exporter.",
  updated: "2026-10-10"
};

vi.mock("./hooks/useMapWorkspaceData", () => ({
  useMapWorkspaceData: () => ({
    assets: ASSETS,
    catalog: makeCatalog(),
    companies: [],
    countryProfiles: [UAE],
    error: null,
    isLoading: false,
    operatorAliases: []
  })
}));

// The real map needs WebGL. This stand-in reports what App handed it and
// lets a test "click" an asset or the SHOW ALL recovery button.
vi.mock("./components/map/MapView", () => ({
  MapView: ({
    focus,
    isVisible,
    onSelectAsset,
    onShowAll,
    selectedAssetId,
    showUnmappedRoutes,
    visibleAssets
  }: {
    focus: { id: string } | null;
    isVisible: boolean;
    onSelectAsset: (asset: InfrastructureAsset) => void;
    onShowAll: () => void;
    selectedAssetId: string | null;
    showUnmappedRoutes: boolean;
    visibleAssets: InfrastructureAsset[];
  }) => (
    <div>
      <div>MAP ASSETS: {visibleAssets.length}</div>
      <div>UNMAPPED ROUTES: {showUnmappedRoutes ? "SHOWN" : "HIDDEN"}</div>
      <div>MAP FOCUS: {focus?.id ?? "NONE"}</div>
      <div>MAP SELECTED: {selectedAssetId ?? "NONE"}</div>
      <div>MAP VISIBLE: {isVisible ? "YES" : "NO"}</div>
      <button onClick={() => onSelectAsset(visibleAssets[0])} type="button">
        CLICK FIRST ASSET
      </button>
      <button onClick={onShowAll} type="button">
        SHOW ALL
      </button>
    </div>
  )
}));

const { App } = await import("./App");

async function renderApp() {
  const user = userEvent.setup();

  render(<App />);
  // The map is lazy-loaded; wait for it before interacting.
  await screen.findByText("MAP ASSETS: 6");

  return user;
}

function selectedCard(name: RegExp) {
  return screen.getByRole("region", { name });
}

const MURBAN = {
  apiGravity: 40,
  id: "murban",
  name: "Murban",
  note: "Onshore grade.",
  producer: "United Arab Emirates",
  producerIso: "ARE",
  source: "EIA",
  sulfurPct: 0.77
};

describe("App", () => {
  // App loads the crude grade table on start, for the Reference view and the search.
  beforeEach(() => {
    // Each test starts at the plain address; the app writes to it as it goes.
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ grades: [MURBAN], source: "EIA" }), ok: true }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens on the map with everything visible and no detail column", async () => {
    await renderApp();

    expect(screen.getByText("SHOWING 6 OF 6 ASSETS")).toBeInTheDocument();
    expect(screen.getByText("MAP SELECTED: NONE")).toBeInTheDocument();
    // Only the controls column: the detail column exists only with a selection.
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
  });

  it("hides a layer's assets when it is toggled off", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("checkbox", { name: /REFINERIES/ }));

    expect(screen.getByText("MAP ASSETS: 4")).toBeInTheDocument();
    expect(screen.getByText("SHOWING 4 OF 6 ASSETS")).toBeInTheDocument();
  });

  it("hides an energy type across every layer", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("checkbox", { name: /NATURAL GAS \/ LNG/ }));

    // The gas pipeline and the LNG terminal both go; oil assets stay.
    expect(screen.getByText("MAP ASSETS: 4")).toBeInTheDocument();
  });

  it("recovers from an empty map with SHOW ALL", async () => {
    const user = await renderApp();

    for (const name of [/CRUDE OIL/, /NATURAL GAS \/ LNG/, /^NGL/, /OIL & GAS \(MIXED\)/]) {
      await user.click(screen.getByRole("checkbox", { name }));
    }
    expect(screen.getByText("MAP ASSETS: 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "SHOW ALL" }));

    expect(screen.getByText("MAP ASSETS: 6")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /CRUDE OIL/ })).toBeChecked();
  });

  it("opens a detail card for an asset picked on the map, with no status for a refinery", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "CLICK FIRST ASSET" }));

    const card = selectedCard(/REFINERY Ruwais Refinery/);
    expect(within(card).getByText("837,000 BPD")).toBeInTheDocument();
    expect(within(card).queryByText(/Status/)).not.toBeInTheDocument();
    expect(screen.getByText("MAP SELECTED: refinery-ruwais")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(screen.getByText("MAP SELECTED: NONE")).toBeInTheDocument();
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
  });

  it("follows an asset's country link into Reference and comes back to the same asset", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "CLICK FIRST ASSET" }));
    await user.click(screen.getByRole("button", { name: "United Arab Emirates ▸" }));

    const country = selectedCard(/COUNTRY United Arab Emirates/);
    expect(screen.getByRole("tab", { name: "COUNTRIES" })).toHaveAttribute("aria-selected", "true");
    expect(within(country).getByText("ADNOC-dominant exporter.")).toBeInTheDocument();
    // The asset the reader came from is listed there, and links back to the map.
    await user.click(within(country).getByRole("button", { name: /Ruwais Refinery/ }));

    expect(screen.getByText("MAP VISIBLE: YES")).toBeInTheDocument();
    expect(screen.getByText("MAP SELECTED: refinery-ruwais")).toBeInTheDocument();
  });

  it("follows an asset's operator link, then on to that operator's other country", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "TABLE" }));
    await user.click(screen.getByRole("tab", { name: "OIL & GAS PIPELINES" }));
    await user.click(screen.getByText("East-West Crude Oil Pipeline"));
    await user.click(screen.getByRole("button", { name: "Saudi Aramco ▸" }));

    const operator = selectedCard(/OPERATOR Saudi Aramco/);
    expect(screen.getByRole("tab", { name: "OPERATORS" })).toHaveAttribute("aria-selected", "true");
    // Both pipelines and the Ghawar field name Saudi Aramco in the data.
    expect(within(operator).getByText("3")).toBeInTheDocument();

    await user.click(within(operator).getByRole("button", { name: "Saudi Arabia" }));

    expect(selectedCard(/COUNTRY Saudi Arabia/)).toBeInTheDocument();
  });

  it("opens a table layer from the glossary even when that layer is switched off", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("checkbox", { name: /LNG TERMINALS/ }));
    await user.click(screen.getByRole("button", { name: "REFERENCE" }));
    await user.click(screen.getByRole("tab", { name: "GLOSSARY" }));
    await user.click(screen.getAllByRole("button", { name: /LNG TERMINALS IN THE TABLE/ })[0]);

    expect(screen.getByRole("tab", { name: "LNG TERMINALS" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Ras Laffan LNG Terminal")).toBeInTheDocument();
  });

  it("hides the dashed pipeline stretches from the map key, without dropping any asset", async () => {
    const user = await renderApp();

    expect(screen.getByText("UNMAPPED ROUTES: SHOWN")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Dashed = route not mapped" }));

    expect(screen.getByText("UNMAPPED ROUTES: HIDDEN")).toBeInTheDocument();
    expect(screen.getByText("MAP ASSETS: 6")).toBeInTheDocument();
  });

  async function pickFilter(user: ReturnType<typeof userEvent.setup>, filter: string, option: RegExp | string) {
    await user.click(screen.getByRole("button", { name: new RegExp(`^${filter}:`) }));
    await user.click(screen.getByRole("option", { name: option }));
  }

  it("narrows the map, the table and the counts to one country, and frames it", async () => {
    const user = await renderApp();

    await pickFilter(user, "COUNTRY", /Saudi Arabia/);

    // East-West, the gas line and Ghawar are Saudi; the rest are not.
    expect(screen.getByText("MAP ASSETS: 3")).toBeInTheDocument();
    expect(screen.getByText("SHOWING 3 OF 6 ASSETS")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /REFINERIES/ }).closest("label")).toHaveTextContent("REFINERIES0");
    expect(screen.getByText("MAP FOCUS: SA|")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "RESET" }));

    expect(screen.getByText("MAP ASSETS: 6")).toBeInTheDocument();
    expect(screen.getByText("MAP FOCUS: NONE")).toBeInTheDocument();
  });

  it("narrows to one operator, offering only operators the chosen country has", async () => {
    const user = await renderApp();

    await pickFilter(user, "COUNTRY", /Egypt/);
    await user.click(screen.getByRole("button", { name: "OPERATOR: ALL" }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["ALL", "Alexandria Petroleum1"]);

    await user.click(screen.getByRole("option", { name: /Alexandria Petroleum/ }));

    expect(screen.getByText("MAP ASSETS: 1")).toBeInTheDocument();
    expect(screen.getByText("MAP FOCUS: EG|alexandria-petroleum")).toBeInTheDocument();
  });

  it("keeps only the largest of each layer, and lets a search hit through the filters", async () => {
    const user = await renderApp();

    await pickFilter(user, "LARGEST", "10 PER LAYER");
    // Every fixture asset reports a size, and no layer has more than ten.
    expect(screen.getByText("MAP ASSETS: 6")).toBeInTheDocument();

    await pickFilter(user, "COUNTRY", /Egypt/);
    expect(screen.getByText("MAP ASSETS: 1")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search the map and reference" }), "ghawar{Enter}");

    expect(screen.getByText("MAP SELECTED: field-ghawar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "COUNTRY: ALL" })).toBeInTheDocument();
  });

  it("shows a country or an operator on the map from its reference entry", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "REFERENCE" }));
    await user.click(screen.getByRole("button", { name: "Egypt" }));
    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    expect(screen.getByText("MAP VISIBLE: YES")).toBeInTheDocument();
    expect(screen.getByText("MAP ASSETS: 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "COUNTRY: Egypt" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "REFERENCE" }));
    await user.click(screen.getByRole("tab", { name: "OPERATORS" }));
    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    // The operator with most assets opens first: Saudi Aramco, with three.
    expect(screen.getByText("MAP ASSETS: 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OPERATOR: Saudi Aramco" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "COUNTRY: ALL" })).toBeInTheDocument();
  });

  it("drops the selection when its layer is switched off", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "CLICK FIRST ASSET" }));
    await user.click(screen.getByRole("checkbox", { name: /REFINERIES/ }));

    expect(screen.getByText("MAP SELECTED: NONE")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Ruwais/ })).not.toBeInTheDocument();
  });

  it("shows the same filtered assets in the table view, sharing the left rail", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("checkbox", { name: /NATURAL GAS \/ LNG/ }));
    await user.click(screen.getByRole("button", { name: "TABLE" }));

    expect(screen.getByText("MAP VISIBLE: NO")).toBeInTheDocument();
    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "OIL & GAS PIPELINES" }));

    expect(screen.getByText("East-West Crude Oil Pipeline")).toBeInTheDocument();
    expect(screen.queryByText("Dolphin Gas Pipeline")).not.toBeInTheDocument();
  });

  it("selects from the table without leaving it, then jumps to the map on request", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "TABLE" }));
    await user.click(screen.getByText("Alexandria Refinery"));

    expect(selectedCard(/REFINERY Alexandria Refinery/)).toBeInTheDocument();
    expect(screen.getByText("MAP VISIBLE: NO")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    expect(screen.getByText("MAP VISIBLE: YES")).toBeInTheDocument();
    expect(screen.getByText("MAP SELECTED: refinery-alexandria")).toBeInTheDocument();
    // On the map the card no longer needs the jump button.
    expect(screen.queryByRole("button", { name: /SHOW ON MAP/ })).not.toBeInTheDocument();
  });

  it("finds an asset by search even when its layer and energy type are switched off", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("checkbox", { name: /LNG TERMINALS/ }));
    await user.click(screen.getByRole("checkbox", { name: /NATURAL GAS \/ LNG/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search the map and reference" }), "ras laffan");
    await user.click(screen.getByText("Ras Laffan LNG Terminal"));

    expect(screen.getByText("MAP SELECTED: terminal-ras-laffan")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /LNG TERMINALS/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /NATURAL GAS \/ LNG/ })).toBeChecked();
    expect(screen.getByRole("searchbox", { name: "Search the map and reference" })).toHaveValue("");
  });

  it("shows reference and about without side columns, and search brings you back to the map", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "CLICK FIRST ASSET" }));
    await user.click(screen.getByRole("button", { name: "ABOUT" }));
    expect(screen.getByRole("heading", { name: "ATLAS / ABOUT" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "REFERENCE" }));
    expect(screen.getByRole("tab", { name: "COUNTRIES" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search the map and reference" }), "ghawar{Enter}");

    expect(screen.getByText("MAP VISIBLE: YES")).toBeInTheDocument();
    expect(screen.getByText("MAP SELECTED: field-ghawar")).toBeInTheDocument();
    expect(screen.getAllByRole("complementary")).toHaveLength(2);
  });

  it("opens a country, an operator or a crude grade in Reference straight from search", async () => {
    const user = await renderApp();
    const searchBox = screen.getByRole("searchbox", { name: "Search the map and reference" });

    await user.type(searchBox, "egypt");
    await user.click(screen.getByText("COUNTRY | 1 ASSET"));

    expect(selectedCard(/COUNTRY Egypt/)).toBeInTheDocument();
    expect(screen.getByText("MAP VISIBLE: NO")).toBeInTheDocument();
    expect(searchBox).toHaveValue("");

    await user.type(searchBox, "aramco");
    await user.click(screen.getByText("OPERATOR | 3 ASSETS"));

    expect(selectedCard(/OPERATOR Saudi Aramco/)).toBeInTheDocument();

    // The grade table loads in the background, so wait for its hit to appear.
    await user.type(searchBox, "murban");
    await user.click(await screen.findByText("CRUDE GRADE | UNITED ARAB EMIRATES"));

    expect(selectedCard(/CRUDE GRADE Murban/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "CRUDE GRADES" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the address in step with the view, the selection and the reference entry", async () => {
    const user = await renderApp();

    expect(window.location.search).toBe("");

    await user.click(screen.getByRole("button", { name: "CLICK FIRST ASSET" }));
    expect(window.location.search).toBe("?asset=refinery-ruwais");

    await user.click(screen.getByRole("button", { name: "United Arab Emirates ▸" }));
    expect(window.location.search).toBe("?view=reference&tab=countries&id=AE");

    await user.click(screen.getByRole("button", { name: "TABLE" }));
    expect(window.location.search).toBe("?view=table&layer=refineries&asset=refinery-ruwais");
  });

  it("steps back through where the reader has been with the browser's back button", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "CLICK FIRST ASSET" }));
    await user.click(screen.getByRole("button", { name: "United Arab Emirates ▸" }));
    expect(selectedCard(/COUNTRY United Arab Emirates/)).toBeInTheDocument();

    window.history.back();

    await waitFor(() => expect(screen.getByText("MAP VISIBLE: YES")).toBeInTheDocument());
    expect(screen.getByText("MAP SELECTED: refinery-ruwais")).toBeInTheDocument();
    expect(window.location.search).toBe("?asset=refinery-ruwais");

    window.history.back();

    await waitFor(() => expect(screen.getByText("MAP SELECTED: NONE")).toBeInTheDocument());
    expect(window.location.search).toBe("");
  });

  it("opens straight on a linked asset, switching its layer on if needed", async () => {
    window.history.replaceState(null, "", "/?asset=field-ghawar");
    await renderApp();

    expect(screen.getByText("MAP SELECTED: field-ghawar")).toBeInTheDocument();
    expect(selectedCard(/FIELD Ghawar Oil Field/)).toBeInTheDocument();
    expect(window.location.search).toBe("?asset=field-ghawar");
  });

  it("opens straight on a linked reference entry", async () => {
    window.history.replaceState(null, "", "/?view=reference&tab=operators&id=saudi-aramco");
    await renderApp();

    expect(screen.getByRole("tab", { name: "OPERATORS" })).toHaveAttribute("aria-selected", "true");
    expect(selectedCard(/OPERATOR Saudi Aramco/)).toBeInTheDocument();
    expect(screen.getByText("MAP VISIBLE: NO")).toBeInTheDocument();
  });
});
