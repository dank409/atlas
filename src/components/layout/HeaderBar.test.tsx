import { fireEvent, render, screen } from "@testing-library/react";
import { HeaderBar } from "./HeaderBar";

const searchResult = {
  assetKind: "pipeline" as const,
  datasetId: "pipelines" as const,
  id: "pipeline-east-west",
  name: "East-West Crude Oil Pipeline",
  country: "SA",
  countryName: "Saudi Arabia",
  owner: "Saudi Aramco",
  operator: "Saudi Aramco",
  status: "operating" as const,
  hydrocarbon: "crude_oil" as const,
  capacity_boed: 5000000,
  diameter_inches: 56,
  length_km: 1200,
  startPoint: "Abqaiq",
  endPoint: "Yanbu",
  geometryConfidence: "high" as const,
  geometry: {
    type: "LineString" as const,
    coordinates: [
      [49.6778, 25.9344] as [number, number],
      [38.0617, 24.0889] as [number, number]
    ]
  },
  linkedContext: {
    companyId: "saudi-aramco",
    countryCode: "SA",
    ticker: "ARAMCO AB Equity"
  },
  _metadata: {
    source: "Approved pipeline seed",
    downloadDate: "2026-04-13"
  }
};

describe("HeaderBar", () => {
  it("renders terminal navigation and switches view modes", () => {
    const onChangeView = vi.fn();
    const onCommandSubmit = vi.fn();
    const onSearchQueryChange = vi.fn();
    const onSelectSearchResult = vi.fn();

    render(
      <HeaderBar
        activeView="map"
        isScenarioActive={false}
        scenarioDisruptionPct={0}
        onChangeView={onChangeView}
        onCommandSubmit={onCommandSubmit}
        onSearchQueryChange={onSearchQueryChange}
        onSelectSearchResult={onSelectSearchResult}
        searchQuery=""
        searchResults={[]}
      />
    );

    expect(screen.getByText("ATLAS")).toBeInTheDocument();
    expect(screen.getByText("MIDDLE EAST")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("TYPE COMMAND OR SEARCH")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "TABLE" }));
    fireEvent.click(screen.getByRole("button", { name: "DASH" }));

    expect(onChangeView).toHaveBeenNthCalledWith(1, "table");
    expect(onChangeView).toHaveBeenNthCalledWith(2, "dash");
  });

  it("shows search results and emits selection events", () => {
    const onChangeView = vi.fn();
    const onCommandSubmit = vi.fn();
    const onSearchQueryChange = vi.fn();
    const onSelectSearchResult = vi.fn();

    render(
      <HeaderBar
        activeView="map"
        isScenarioActive={false}
        scenarioDisruptionPct={0}
        onChangeView={onChangeView}
        onCommandSubmit={onCommandSubmit}
        onSearchQueryChange={onSearchQueryChange}
        onSelectSearchResult={onSelectSearchResult}
        searchQuery="east"
        searchResults={[searchResult]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("TYPE COMMAND OR SEARCH"), {
      target: { value: "east-west" }
    });
    fireEvent.click(screen.getByRole("button", { name: /East-West Crude Oil Pipeline/i }));

    expect(onSearchQueryChange).toHaveBeenCalledWith("east-west");
    expect(onSelectSearchResult).toHaveBeenCalledWith(searchResult);
    expect(onCommandSubmit).not.toHaveBeenCalled();
  });
});
