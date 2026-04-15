import { fireEvent, render, screen, within } from "@testing-library/react";

const workspaceData = {
  catalog: [
    {
      id: "refineries",
      title: "REFINERIES",
      source: "Global Energy Monitor",
      frequency: "Quarterly",
      coverage: "Middle East",
      notes: "Operational and outage-aware refinery seed coverage",
      status: "available",
      recordCount: 2,
      defaultActive: true
    },
    {
      id: "pipelines",
      title: "CRUDE / GAS PIPELINES",
      source: "Global Energy Monitor",
      frequency: "Quarterly",
      coverage: "Middle East",
      notes: "Curated route geometries from seed infrastructure references",
      status: "available",
      recordCount: 2,
      defaultActive: true
    },
    {
      id: "chokepoints",
      title: "CHOKEPOINTS",
      source: "EIA + curated reference",
      frequency: "Periodic",
      coverage: "Middle East",
      notes: "Strategic oil transit constraints and bypass context",
      status: "available",
      recordCount: 1,
      defaultActive: true
    },
    {
      id: "fields",
      title: "OIL & GAS FIELDS",
      source: "Global Energy Monitor",
      frequency: "Quarterly",
      coverage: "Middle East",
      notes: "GOGET field centroids with production context",
      status: "available",
      recordCount: 2,
      defaultActive: false
    },
    {
      id: "terminals",
      title: "TERMINALS / LNG",
      source: "Global Energy Monitor",
      frequency: "Quarterly",
      coverage: "Middle East",
      notes: "GGIT LNG import and export sites",
      status: "available",
      recordCount: 1,
      defaultActive: false
    }
  ],
  assets: [
    {
      assetKind: "refinery",
      datasetId: "refineries",
      id: "refinery-ras-tanura",
      name: "Ras Tanura Refinery",
      country: "SA",
      countryName: "Saudi Arabia",
      owner: "Saudi Arabian Oil Co",
      operator: "Saudi Arabian Oil Co",
      status: "operational",
      capacity_bpd: 550000,
      capacityUnit: "bpd",
      lat: 26.6437,
      lon: 50.1544,
      linkedContext: {
        companyId: "saudi-aramco",
        countryCode: "SA",
        ticker: "ARAMCO AB Equity"
      },
      _metadata: {
        source: "Approved refinery seed",
        downloadDate: "2026-04-13"
      }
    },
    {
      assetKind: "refinery",
      datasetId: "refineries",
      id: "refinery-ruwais",
      name: "Ruwais Refinery",
      country: "AE",
      countryName: "United Arab Emirates",
      owner: "Abu Dhabi National Oil Co",
      operator: "ADNOC Refining",
      status: "planned_maintenance",
      capacity_bpd: 837000,
      capacityUnit: "bpd",
      lat: 24.1108,
      lon: 54.0894,
      linkedContext: {
        companyId: "adnoc",
        countryCode: "AE",
        ticker: "ADNOCDIST EY Equity"
      },
      _metadata: {
        source: "Approved refinery seed",
        downloadDate: "2026-04-13"
      }
    },
    {
      assetKind: "pipeline",
      datasetId: "pipelines",
      id: "pipeline-east-west",
      name: "East-West Crude Oil Pipeline",
      country: "SA",
      countryName: "Saudi Arabia",
      owner: "Saudi Aramco",
      operator: "Saudi Aramco",
      status: "operating",
      hydrocarbon: "crude_oil",
      capacity_boed: 5000000,
      diameter_inches: 56,
      length_km: 1200,
      startPoint: "Abqaiq",
      endPoint: "Yanbu",
      linkedContext: {
        companyId: "saudi-aramco",
        countryCode: "SA",
        ticker: "ARAMCO AB Equity"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [49.6778, 25.9344],
          [38.0617, 24.0889]
        ]
      },
      _metadata: {
        source: "Approved pipeline seed",
        downloadDate: "2026-04-13"
      }
    },
    {
      assetKind: "pipeline",
      datasetId: "pipelines",
      id: "pipeline-marjan",
      name: "Marjan Oil Pipeline",
      country: "SA",
      countryName: "Saudi Arabia",
      owner: "Saudi Aramco",
      operator: "Saudi Aramco",
      status: "construction",
      hydrocarbon: "crude_oil",
      capacity_boed: 300000,
      diameter_inches: 36,
      length_km: 100,
      startPoint: "Marjan",
      endPoint: "Tanajib",
      linkedContext: {
        companyId: "saudi-aramco",
        countryCode: "SA",
        ticker: "ARAMCO AB Equity"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [49.572, 27.981],
          [49.658, 27.921]
        ]
      },
      _metadata: {
        source: "Approved pipeline seed",
        downloadDate: "2026-04-13"
      }
    },
    {
      assetKind: "chokepoint",
      datasetId: "chokepoints",
      id: "chokepoint-hormuz",
      name: "Strait of Hormuz",
      country: "ME",
      countryName: "Middle East",
      status: "strategic",
      transitVolume_mbpd: 20.5,
      linkedContext: {
        countryCode: "SA",
        benchmarkRefs: ["Dated Brent", "Dubai"]
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [56.0, 26.7],
          [56.5, 26.3]
        ]
      },
      _metadata: {
        source: "Approved chokepoint seed",
        downloadDate: "2026-04-13"
      }
    }
  ],
  companiesById: {
    adnoc: {
      id: "adnoc",
      name: "Abu Dhabi National Oil Company",
      summary: "Integrated producer, refiner, petrochemical operator, and exporter anchored in Abu Dhabi.",
      domicile: "United Arab Emirates",
      website: "www.adnoc.ae",
      tickers: ["ADNOCDIST EY Equity"],
      benchmarks: ["Murban", "Dubai"],
      source: "Curated operator profile",
      updated: "2026-04-13"
    },
    "saudi-aramco": {
      id: "saudi-aramco",
      name: "Saudi Aramco",
      summary: "Integrated oil major spanning upstream, refining, petrochemicals, and export infrastructure.",
      domicile: "Saudi Arabia",
      website: "www.aramco.com",
      tickers: ["ARAMCO AB Equity"],
      benchmarks: ["Arab Light", "Dubai", "Dated Brent"],
      source: "Curated operator profile",
      updated: "2026-04-13"
    }
  },
  countriesByCode: {
    AE: {
      code: "AE",
      name: "United Arab Emirates",
      summary: "ADNOC-dominant exporter with Fujairah bypass relevance for Hormuz risk analysis.",
      keyGrades: ["Murban"],
      chokepointDependency: "Has bypass via Fujairah but remains Gulf-system critical.",
      source: "Curated country profile",
      updated: "2026-04-13"
    },
    SA: {
      code: "SA",
      name: "Saudi Arabia",
      summary: "Largest OPEC producer with major refining and pipeline bypass infrastructure.",
      keyGrades: ["Arab Light", "Arab Heavy"],
      chokepointDependency: "Partial Hormuz hedge via East-West pipeline to Yanbu.",
      source: "Curated country profile",
      updated: "2026-04-13"
    }
  }
};

vi.mock("./components/map/MapView", () => ({
  MapView: ({
    activeDatasetIds,
    selectedAssetId,
    visibleAssets
  }: {
    activeDatasetIds: string[];
    selectedAssetId: string | null;
    visibleAssets: Array<{ id: string; name: string }>;
  }) => (
    <div>
      <div>MAP VIEW ACTIVE: {activeDatasetIds.length} DATASETS / {visibleAssets.length} ASSETS</div>
      <div>MAP SELECTED: {selectedAssetId ?? "NONE"}</div>
    </div>
  )
}));

vi.mock("./hooks/useMapWorkspaceData", () => ({
  useMapWorkspaceData: () => ({
    ...workspaceData,
    error: null,
    isLoading: false
  })
}));

import { App } from "./App";

describe("App MAP workspace", () => {
  it("renders a Bloomberg-style map workspace with catalog, rail, and mixed-asset grid", async () => {
    render(<App />);
    const catalogPanel = screen.getByText("DATASET CATALOG").closest("section")!;
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    expect(await screen.findByText("MAP VIEW ACTIVE: 3 DATASETS / 5 ASSETS")).toBeInTheDocument();
    expect(screen.getByText("DATASET CATALOG")).toBeInTheDocument();
    expect(screen.getByText("MAP CONTENT")).toBeInTheDocument();
    expect(screen.getByText("ASSET GRID")).toBeInTheDocument();
    expect(within(catalogPanel).getByRole("button", { name: /REFINERIES/ })).toBeInTheDocument();
    expect(within(catalogPanel).getByRole("button", { name: /CRUDE \/ GAS PIPELINES/ })).toBeInTheDocument();
    expect(within(catalogPanel).getByRole("button", { name: /CHOKEPOINTS/ })).toBeInTheDocument();
    expect(within(catalogPanel).getByText("OIL & GAS FIELDS")).toBeInTheDocument();
    expect(within(catalogPanel).queryByText("CURATING")).not.toBeInTheDocument();
    expect(within(gridPanel).getByText("Ras Tanura Refinery")).toBeInTheDocument();
    expect(within(gridPanel).getByText("Ruwais Refinery")).toBeInTheDocument();
    expect(within(gridPanel).queryByText("East-West Crude Oil Pipeline")).not.toBeInTheDocument();
  });

  it("focuses the bottom grid on the selected dataset and shows dataset-aware pipeline columns", async () => {
    render(<App />);
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    fireEvent.click(screen.getByRole("button", { name: /CRUDE \/ GAS PIPELINES/ }));

    // Columns were pared to NAME / COUNTRY / CAPACITY / STATUS —
    // drill-down fields (HYDROCARBON, OWNER, LENGTH, REFERENCE)
    // live in the inspect overlay that opens on row click.
    expect(await screen.findByRole("button", { name: "SORT BY CAPACITY" })).toBeInTheDocument();
    expect(within(gridPanel).getByText("Marjan Oil Pipeline")).toBeInTheDocument();
    expect(within(gridPanel).getByText("East-West Crude Oil Pipeline")).toBeInTheDocument();
    expect(within(gridPanel).queryByText("Ras Tanura Refinery")).not.toBeInTheDocument();
  });

  it("treats chokepoints as a first-class focused grid dataset instead of dropping into an empty state", async () => {
    render(<App />);
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    fireEvent.click(screen.getByRole("button", { name: /CHOKEPOINTS/ }));

    expect(await screen.findByRole("button", { name: "SORT BY TRANSIT" })).toBeInTheDocument();
    expect(within(gridPanel).getByText("Strait of Hormuz")).toBeInTheDocument();
    expect(within(gridPanel).queryByText(/NO VISIBLE ASSETS/i)).not.toBeInTheDocument();
  });

  it("executes command-bar view and asset commands from the header", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("COMMAND"), {
      target: { value: "dash" }
    });
    fireEvent.submit(screen.getByLabelText("COMMAND").closest("form")!);

    expect(await screen.findByText("SITUATION ROOM")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("COMMAND"), {
      target: { value: "ref ruwais" }
    });
    fireEvent.submit(screen.getByLabelText("COMMAND").closest("form")!);

    expect(await screen.findByText("MAP SELECTED: refinery-ruwais")).toBeInTheDocument();
  });

  it("surfaces the selected asset in the persistent context rail via the inspect overlay", async () => {
    render(<App />);
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    // Row click now opens the inspect overlay (Bloomberg selector
    // pattern). Committing to a map fly-to + context-rail selection
    // requires the explicit VIEW ON MAP action in the overlay footer.
    fireEvent.click((await within(gridPanel).findByText("Ruwais Refinery")).closest("tr")!);
    fireEvent.click(await screen.findByRole("button", { name: /VIEW ON MAP/i }));

    const detailPanel = (await screen.findByText("ASSET DETAIL")).closest("section")!;
    expect(within(detailPanel).getByText("Ruwais Refinery")).toBeInTheDocument();
  });

  it("searches across mixed assets and selects a pipeline into the map detail workflow", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("COMMAND"), {
      target: { value: "east-west" }
    });

    fireEvent.click(screen.getByRole("button", { name: /East-West Crude Oil Pipeline/i }));
    const operatorPanel = screen.getByText("OPERATOR CONTEXT").closest("section")!;

    expect(await screen.findByText("MAP SELECTED: pipeline-east-west")).toBeInTheDocument();
    expect(within(operatorPanel).getByText("Saudi Aramco")).toBeInTheDocument();
    expect(within(operatorPanel).getByText(/Arab Light/)).toBeInTheDocument();
  });

  it("focuses search with slash, clears selection with escape, and opens a shortcuts overlay with question mark", async () => {
    render(<App />);
    const searchInput = screen.getByLabelText("COMMAND");
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    fireEvent.keyDown(window, { key: "/" });
    expect(searchInput).toHaveFocus();

    // Two-step selection: row click opens the inspect overlay, then
    // VIEW ON MAP commits the selection and closes the overlay.
    fireEvent.click((await within(gridPanel).findByText("Ruwais Refinery")).closest("tr")!);
    fireEvent.click(await screen.findByRole("button", { name: /VIEW ON MAP/i }));
    expect(await screen.findByText("MAP SELECTED: refinery-ruwais")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByText("SHORTCUTS")).toBeInTheDocument();
    expect(screen.getByText("TOGGLE RIGHT RAIL")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("SHORTCUTS")).not.toBeInTheDocument();
    expect(screen.getByText("MAP SELECTED: NONE")).toBeInTheDocument();
  });

  it("toggles active datasets from the keyboard with numeric shortcuts", async () => {
    render(<App />);

    expect(await screen.findByText("MAP VIEW ACTIVE: 3 DATASETS / 5 ASSETS")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "1" });
    expect(await screen.findByText("MAP VIEW ACTIVE: 2 DATASETS / 3 ASSETS")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "2" });
    expect(await screen.findByText("MAP VIEW ACTIVE: 1 DATASETS / 1 ASSETS")).toBeInTheDocument();
  });

  it("collapses the right rail with the bracket shortcut and reopens it when an asset is selected", async () => {
    render(<App />);
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    // No asset selected yet: right rail shows MAP CONTENT (legend/filters),
    // not ASSET DETAIL. ASSET DETAIL only appears once an asset is selected.
    expect(screen.getByText("MAP CONTENT")).toBeInTheDocument();
    expect(screen.queryByText("ASSET DETAIL")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "]" });
    expect(screen.queryByText("MAP CONTENT")).not.toBeInTheDocument();

    // Row click → inspect overlay → VIEW ON MAP commits selection
    // and auto-reopens the right rail so ASSET DETAIL is visible.
    fireEvent.click((await within(gridPanel).findByText("Ruwais Refinery")).closest("tr")!);
    fireEvent.click(await screen.findByRole("button", { name: /VIEW ON MAP/i }));
    const detailPanel = await screen.findByText("ASSET DETAIL");
    expect(detailPanel).toBeInTheDocument();
    expect(within(detailPanel.closest("section")!).getByText("Ruwais Refinery")).toBeInTheDocument();
  });

  it("pushes a country overlay when the COUNTRY cell is clicked inside the asset overlay, then pops back", async () => {
    // End-to-end proof the overlay navigation stack works:
    //   grid click → asset overlay (fresh stack, no back button)
    //   click COUNTRY cell → country overlay pushed, back button appears
    //   click BACK → country pops, asset overlay restored
    render(<App />);
    const gridPanel = (await screen.findByText("ASSET GRID")).closest("section")!;

    fireEvent.click((await within(gridPanel).findByText("Ruwais Refinery")).closest("tr")!);

    // Asset overlay is the freshly opened (only) entry on the stack,
    // so there is no BACK button yet.
    const assetHeadline = await screen.findByText("RUWAIS REFINERY");
    expect(assetHeadline).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Back to previous/i })
    ).not.toBeInTheDocument();

    // Click the COUNTRY cell — it resolves to the curated UAE profile
    // and pushes a country overlay onto the stack.
    fireEvent.click(screen.getByTitle("Expand United Arab Emirates"));
    expect(await screen.findByText("UNITED ARAB EMIRATES")).toBeInTheDocument();
    // The country overlay is now on top with an asset entry beneath,
    // so BACK is visible.
    const backButton = screen.getByRole("button", { name: /Back to previous/i });
    expect(backButton).toBeInTheDocument();

    // Click BACK — country pops, asset overlay is back on screen.
    fireEvent.click(backButton);
    expect(await screen.findByText("RUWAIS REFINERY")).toBeInTheDocument();
    // And the back button is gone again (stack is back to 1 entry).
    expect(
      screen.queryByRole("button", { name: /Back to previous/i })
    ).not.toBeInTheDocument();
  });
});
