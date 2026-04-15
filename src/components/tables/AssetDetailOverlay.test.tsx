import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetDetailOverlay } from "./AssetDetailOverlay";
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
  linkedContext: {
    companyId: "adnoc",
    countryCode: "AE"
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
    keyGrades: ["MURBAN"],
    name: "United Arab Emirates",
    source: "Curated",
    summary: "Gulf OPEC producer.",
    updated: "2026-04-14"
  }
};

describe("AssetDetailOverlay", () => {
  it("renders plain text rows when no profile registries are provided", () => {
    // Fallback behaviour: without registries, OPERATOR / OWNER /
    // COUNTRY are inert text. The component must still render the
    // full record so it's usable as a standalone drill-down.
    render(
      <AssetDetailOverlay
        asset={refinery}
        onClose={vi.fn()}
        onViewOnMap={vi.fn()}
      />
    );

    expect(screen.getByText("COUNTRY")).toBeInTheDocument();
    expect(screen.getByText("OPERATOR")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
    // No "COUNTRY ▸" / "OPERATOR ▸" affordance glyphs when not
    // resolvable — the label stays plain.
    expect(screen.queryByText(/COUNTRY ▸/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OPERATOR ▸/)).not.toBeInTheDocument();
  });

  it("routes COUNTRY row clicks through onInspectCountry when the country resolves", () => {
    const onInspectCountry = vi.fn();
    const onInspectCompany = vi.fn();

    render(
      <AssetDetailOverlay
        asset={refinery}
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        onClose={vi.fn()}
        onInspectCompany={onInspectCompany}
        onInspectCountry={onInspectCountry}
        onViewOnMap={vi.fn()}
      />
    );

    // Resolved COUNTRY cell renders as a button with a title hint
    // like "Expand United Arab Emirates".
    fireEvent.click(screen.getByTitle("Expand United Arab Emirates"));

    expect(onInspectCountry).toHaveBeenCalledTimes(1);
    expect(onInspectCountry).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AE" })
    );
    expect(onInspectCompany).not.toHaveBeenCalled();
  });

  it("routes OPERATOR row clicks through onInspectCompany when the company resolves", () => {
    const onInspectCompany = vi.fn();

    render(
      <AssetDetailOverlay
        asset={refinery}
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        onClose={vi.fn()}
        onInspectCompany={onInspectCompany}
        onInspectCountry={vi.fn()}
        onViewOnMap={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle("Expand ADNOC Refining"));

    expect(onInspectCompany).toHaveBeenCalledTimes(1);
    expect(onInspectCompany).toHaveBeenCalledWith(
      expect.objectContaining({ id: "adnoc" })
    );
  });

  it("leaves COUNTRY row inert when the country code is not in the registry", () => {
    // Iran isn't in the fixture registry — the row must fall back
    // to plain text, not render as a dangling button with no handler.
    const iranianRefinery: InfrastructureAsset = {
      ...refinery,
      id: "refinery-abadan",
      name: "Abadan Refinery",
      country: "IR",
      countryName: "Iran",
      linkedContext: { countryCode: "IR" }
    };

    render(
      <AssetDetailOverlay
        asset={iranianRefinery}
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        onClose={vi.fn()}
        onInspectCompany={vi.fn()}
        onInspectCountry={vi.fn()}
        onViewOnMap={vi.fn()}
      />
    );

    // COUNTRY cell is still rendered with the country name…
    expect(screen.getByText("Iran")).toBeInTheDocument();
    // …but there's no "Expand Iran" button — the row is plain text.
    expect(screen.queryByTitle("Expand Iran")).not.toBeInTheDocument();
  });

  it("renders a BACK button only when canGoBack is true", () => {
    // canGoBack=false: no back button rendered (fresh overlay, no
    // history behind it).
    const { rerender } = render(
      <AssetDetailOverlay
        asset={refinery}
        canGoBack={false}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onViewOnMap={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Back to previous/i })).not.toBeInTheDocument();

    // canGoBack=true: back button is visible and wired to onBack.
    const onBack = vi.fn();
    rerender(
      <AssetDetailOverlay
        asset={refinery}
        canGoBack={true}
        onBack={onBack}
        onClose={vi.fn()}
        onViewOnMap={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Back to previous/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("fires onViewOnMap and closes the overlay when VIEW ON MAP is clicked", () => {
    const onClose = vi.fn();
    const onViewOnMap = vi.fn();

    render(
      <AssetDetailOverlay
        asset={refinery}
        onClose={onClose}
        onViewOnMap={onViewOnMap}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /VIEW ON MAP/i }));

    expect(onViewOnMap).toHaveBeenCalledTimes(1);
    expect(onViewOnMap).toHaveBeenCalledWith(
      expect.objectContaining({ id: "refinery-ruwais" })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
