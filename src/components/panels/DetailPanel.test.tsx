import { render, screen } from "@testing-library/react";
import { DetailPanel } from "./DetailPanel";
import type { RefineryProperties } from "../../types/Refinery";

const refinery: RefineryProperties = {
  id: "refinery-ras-tanura",
  name: "Ras Tanura Refinery",
  country: "SA",
  countryName: "Saudi Arabia",
  owner: "Saudi Arabian Oil Co",
  operator: "Saudi Arabian Oil Co",
  status: "operational",
  capacity_bpd: 550000,
  capacityUnit: "bpd",
  type: "refinery",
  lat: 26.6437,
  lon: 50.1544,
  firmsRadius_km: 5,
  ticker: "ARAMCO AB Equity"
};

describe("DetailPanel", () => {
  it("shows refinery metadata and attribution", () => {
    render(
      <DetailPanel
        metadata={{
          source: "Approved spec bootstrap dataset",
          downloadDate: "2026-04-13",
          recordCount: 1
        }}
        refinery={refinery}
      />
    );

    expect(screen.getByText("Ras Tanura Refinery")).toBeInTheDocument();
    expect(screen.getAllByText("Saudi Arabian Oil Co")).toHaveLength(2);
    expect(screen.getByText("550,000 bpd")).toBeInTheDocument();
    expect(screen.getByText("ARAMCO AB Equity")).toBeInTheDocument();
    expect(screen.getByText("Source: Approved spec bootstrap dataset")).toBeInTheDocument();
    expect(screen.getByText("Updated: 2026-04-13")).toBeInTheDocument();
  });
});
