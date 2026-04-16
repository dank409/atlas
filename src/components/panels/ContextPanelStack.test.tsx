import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextPanelStack } from "./ContextPanelStack";
import type { ExposureRegistryEntry } from "../../types/Exposure";
import type {
  CompanyProfile,
  CountryProfile,
  InfrastructureAsset
} from "../../types/Infrastructure";
import type { FirmsSnapshot } from "../../types/firms";
import type { OutageEventSnapshot } from "../../types/outageEvent";

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
  hormuzDependency: 0.3,
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
    chokepointDependency: "Partial Hormuz hedge via Fujairah bypass.",
    code: "AE",
    keyGrades: ["MURBAN", "UPPER ZAKUM"],
    name: "United Arab Emirates",
    source: "Curated",
    summary: "Gulf OPEC producer.",
    updated: "2026-04-14"
  }
};

const exposureByTargetId: Record<string, ExposureRegistryEntry> = {
  "refinery-ruwais": {
    targetId: "refinery-ruwais",
    targetKind: "asset",
    displayName: "Ruwais Refinery",
    dependencyScore: 0.3,
    exportRoute: "ADCOP / Fujairah bypass corridor",
    primaryChokepointId: "chokepoint-hormuz",
    primaryChokepointLabel: "Strait of Hormuz",
    modeledAtRiskMbpd: 0.3,
    relevantBenchmarks: ["Murban", "Brent-WTI"]
  },
  AE: {
    targetId: "AE",
    targetKind: "country",
    displayName: "United Arab Emirates",
    primaryChokepointId: "chokepoint-hormuz",
    primaryChokepointLabel: "Strait of Hormuz",
    seaborneExportsMbpd: 3.4,
    bypassCapacityMbpd: 1.5,
    modeledAtRiskMbpd: 1.9
  }
};

const firmsSnapshot: FirmsSnapshot = {
  asOf: "2026-04-14T12:00:00Z",
  cadence: "NRT_SATELLITE",
  classification: "OBSERVED",
  confidenceThreshold: 80,
  detections: [],
  matches: [],
  anomalies: [
    {
      asset: {
        id: "refinery-ruwais",
        name: "Ruwais Refinery",
        assetType: "refinery",
        center: { lat: 24.11, lon: 54.09 },
        radiusKm: 5,
        owner: "ADNOC",
        capacityBpd: 837000
      },
      windowCount: 4,
      baselineMean: 1.2,
      baselineStdev: 0.6,
      zScore: 4.7,
      ratioToBaseline: 3.3,
      severity: "ALERT",
      latestDetectionAt: "2026-04-14T10:00:00Z"
    }
  ],
  source: "NASA FIRMS",
  windowHours: 72
};

const outageEvents: OutageEventSnapshot = {
  asOf: "2026-04-15",
  cadence: "CURATED",
  classification: "CURATED",
  source: "Curated",
  events: [
    {
      id: "ruwais-outage",
      date: "2026-04-10",
      name: "Ruwais Unit Fire",
      country: "United Arab Emirates",
      assetId: "refinery-ruwais",
      severity: "MEDIUM",
      category: "accident",
      outageVolumeBpd: 120000,
      durationDays: 4,
      summary: "Contained process-unit fire.",
      resolved: true
    }
  ]
};

describe("ContextPanelStack", () => {
  it("shows four context placeholders when no asset is selected", () => {
    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        selectedAsset={null}
      />
    );

    expect(screen.getByText("SELECT AN ASSET FROM THE MAP OR GRID.")).toBeInTheDocument();
    expect(screen.getByText("SELECT AN ASSET TO SEE FIRMS AND OUTAGE SIGNALS.")).toBeInTheDocument();
    expect(screen.getByText("SELECT AN ASSET TO SEE ROUTE AND CHOKEPOINT DEPENDENCY.")).toBeInTheDocument();
    expect(screen.getByText("SELECT AN ASSET TO SEE MODELED EXPOSURE.")).toBeInTheDocument();
  });

  it("renders structural, observed, curated, and modeled context for a scored asset", () => {
    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        exposureByTargetId={exposureByTargetId}
        firmsSnapshot={firmsSnapshot}
        outageEvents={outageEvents}
        selectedAsset={refinery}
      />
    );

    expect(screen.getByText("STRUCTURAL PROFILE")).toBeInTheDocument();
    expect(screen.getByText("OBSERVED SIGNALS")).toBeInTheDocument();
    expect(screen.getByText("CURATED DEPENDENCY")).toBeInTheDocument();
    expect(screen.getByText("MODELED EXPOSURE")).toBeInTheDocument();

    expect(screen.getByText("Ruwais Refinery")).toBeInTheDocument();
    expect(screen.getByText("CADENCE: QUARTERLY")).toBeInTheDocument();
    expect(screen.getByText("ALERT")).toBeInTheDocument();
    expect(screen.getByText("ADCOP / Fujairah bypass corridor")).toBeInTheDocument();
    expect(screen.getAllByText("Strait of Hormuz").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("~0.3 MBPD").length).toBeGreaterThanOrEqual(1);
  });

  it("renders UNSCORED modeled context when the asset has no registry entry", () => {
    const iranianRefinery: InfrastructureAsset = {
      ...refinery,
      id: "refinery-abadan",
      name: "Abadan Refinery",
      country: "IR",
      countryName: "Iran",
      linkedContext: { countryCode: "IR" },
      hormuzDependency: undefined
    };

    render(
      <ContextPanelStack
        companiesById={companiesById}
        countriesByCode={countriesByCode}
        selectedAsset={iranianRefinery}
      />
    );

    expect(screen.getByText("UNSCORED. NO CURATED EXPOSURE ENTRY.")).toBeInTheDocument();
    expect(screen.getAllByText("UNSCORED").length).toBeGreaterThanOrEqual(1);
  });
});
