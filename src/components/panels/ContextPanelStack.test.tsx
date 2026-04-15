import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextPanelStack } from "./ContextPanelStack";
import type {
  CompanyProfile,
  CountryProfile,
  InfrastructureAsset
} from "../../types/Infrastructure";

const refinery: InfrastructureAsset = {
  assetKind: "refinery",
  datasetId: "refineries",
  id: "refinery-ruwais",
  name: "Ruwais Refinery",
  country: "AE",
  countryName: "United Arab Emirates",
  owner: "Abu Dhabi National Oil Company",
  operator: "ADNOC Refining",
  status: "operational",
  capacity_bpd: 837000,
  capacityUnit: "bpd",
  lat: 24.1108,
  lon: 54.0894,
  firmsRadius_km: 5,
  linkedContext: {
    companyId: "adnoc",
    countryCode: "AE",
    ticker: "ADNOCDIST EY"
  },
  _metadata: {
    source: "OGIM",
    downloadDate: "2026-04-14"
  }
};

const companiesById: Record<string, CompanyProfile> = {
  adnoc: {
    id: "adnoc",
    name: "ADNOC",
    benchmarks: ["MURBAN"],
    domicile: "UAE",
    source: "Curated",
    summary: "Abu Dhabi National Oil Company.",
    tickers: ["ADNOCDIST EY"],
    updated: "2026-04-14",
    website: "https://adnoc.ae"
  }
};

const countriesByCode: Record<string, CountryProfile> = {
  AE: {
    chokepointDependency: "HORMUZ",
    code: "AE",
    keyGrades: ["MURBAN", "UPPER ZAKUM"],
    name: "United Arab Emirates",
    source: "Curated",
    summary: "Gulf OPEC producer.",
    updated: "2026-04-14"
  }
};

describe("ContextPanelStack", () => {
  it("shows 'select an asset' placeholder copy in all three panels when no asset is selected", () => {
    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        selectedAsset={null}
      />
    );

    expect(screen.getByText("SELECT AN ASSET FROM THE MAP OR GRID.")).toBeInTheDocument();
    expect(screen.getByText("SELECT AN ASSET TO SEE OPERATOR CONTEXT.")).toBeInTheDocument();
    expect(screen.getByText("SELECT AN ASSET TO SEE COUNTRY CONTEXT.")).toBeInTheDocument();
    // "COMING SOON" badge must NOT render until a user selects an asset — it
    // would misrepresent the idle empty state as a coverage gap.
    expect(screen.queryByText("COMING SOON")).not.toBeInTheDocument();
  });

  it("renders asset, operator, and country detail when everything links", () => {
    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        selectedAsset={refinery}
      />
    );

    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();
    // "United Arab Emirates" appears as both the asset summary line (scoped
    // to the refinery) and the country-context panel primaryName, so match
    // all and expect at least two.
    expect(screen.getAllByText(/United Arab Emirates/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("ADNOC")).toBeInTheDocument();
    expect(screen.getByText("Abu Dhabi National Oil Company.")).toBeInTheDocument();
    expect(screen.getByText("Gulf OPEC producer.")).toBeInTheDocument();
    expect(screen.getByText("HORMUZ")).toBeInTheDocument();
  });

  it("surfaces the asset source and updated-date attribution", () => {
    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        selectedAsset={refinery}
      />
    );

    // Asset source is unique ("OGIM"); company/country share "Curated".
    expect(screen.getByText("SOURCE: OGIM")).toBeInTheDocument();
    // Three panels each emit their own UPDATED row — confirm at least one.
    expect(screen.getAllByText("UPDATED: 2026-04-14").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the UNMAPPED OPERATOR notice with last-known operator when the asset has no linked company", () => {
    const unlinkedAsset: InfrastructureAsset = {
      ...refinery,
      linkedContext: { countryCode: "AE" }
    };

    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        selectedAsset={unlinkedAsset}
      />
    );

    expect(screen.getByText("UNMAPPED OPERATOR")).toBeInTheDocument();
    expect(
      screen.getByText(/Profile forthcoming\. This operator is not yet/)
    ).toBeInTheDocument();
    // Last-known-operator row pulls the raw operator field from the asset.
    // "ADNOC Refining" also appears in the asset-detail panel Operator row,
    // so we assert there are at least two — one from each panel.
    expect(screen.getAllByText("ADNOC Refining").length).toBeGreaterThanOrEqual(2);
    // Country panel still resolves because AE IS in the registry.
    expect(screen.getByText("Gulf OPEC producer.")).toBeInTheDocument();
    // Exactly one COMING SOON badge (operator panel), not two.
    expect(screen.getAllByText("COMING SOON")).toHaveLength(1);
  });

  it("routes operator and country section clicks through onInspect callbacks when provided", () => {
    const onInspectCompany = vi.fn();
    const onInspectCountry = vi.fn();

    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        onInspectCompany={onInspectCompany}
        onInspectCountry={onInspectCountry}
        selectedAsset={refinery}
      />
    );

    // When drill-down callbacks are supplied, both sections render
    // as <button> elements with an "EXPAND ▸" badge on the panel
    // header so the click affordance is visible without hovering.
    expect(screen.getAllByText("EXPAND ▸")).toHaveLength(2);

    // Operator click → onInspectCompany with the resolved profile.
    // The button exposes its purpose via a `title` attribute, so
    // we look it up by title rather than accessible name.
    fireEvent.click(screen.getByTitle("Expand ADNOC profile"));
    expect(onInspectCompany).toHaveBeenCalledTimes(1);
    expect(onInspectCompany).toHaveBeenCalledWith(
      expect.objectContaining({ id: "adnoc" })
    );
    expect(onInspectCountry).not.toHaveBeenCalled();

    // Country click → onInspectCountry with the resolved profile.
    fireEvent.click(screen.getByTitle("Expand United Arab Emirates profile"));
    expect(onInspectCountry).toHaveBeenCalledTimes(1);
    expect(onInspectCountry).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AE" })
    );
  });

  it("shows the UNMAPPED COUNTRY notice with a live covered-country list for countries not in the registry", () => {
    const iranianRefinery: InfrastructureAsset = {
      ...refinery,
      id: "refinery-abadan",
      name: "Abadan Refinery",
      country: "IR",
      countryName: "Iran",
      linkedContext: { countryCode: "IR" }
    };

    const multiCountryRegistry: Record<string, CountryProfile> = {
      AE: countriesByCode.AE,
      SA: {
        chokepointDependency: "HORMUZ",
        code: "SA",
        keyGrades: ["ARAB LIGHT"],
        name: "Saudi Arabia",
        source: "Curated",
        summary: "OPEC swing producer.",
        updated: "2026-04-14"
      }
    };

    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={multiCountryRegistry}
        selectedAsset={iranianRefinery}
      />
    );

    expect(screen.getByText("UNMAPPED COUNTRY")).toBeInTheDocument();
    expect(
      screen.getByText(/Profile forthcoming\. Other Middle East countries/)
    ).toBeInTheDocument();
    // "Iran" shows up in the asset-detail summary line AND in the unmapped
    // notice's selected-country row — assert both.
    expect(screen.getAllByText("Iran").length).toBeGreaterThanOrEqual(2);
    // Covered list is dynamic — driven by the registry keys, sorted.
    expect(
      screen.getByText("SAUDI ARABIA · UNITED ARAB EMIRATES")
    ).toBeInTheDocument();
    // Both operator AND country panels have a COMING SOON badge because
    // neither profile resolves for this asset.
    expect(screen.getAllByText("COMING SOON")).toHaveLength(2);
  });
});
