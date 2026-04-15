import { fireEvent, render, screen } from "@testing-library/react";
import { RefineriesTable } from "./RefineriesTable";
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

describe("RefineriesTable", () => {
  it("renders refinery rows and notifies selection", () => {
    const onSelectRefinery = vi.fn();

    render(
      <RefineriesTable
        metadata={{
          source: "Approved spec bootstrap dataset",
          downloadDate: "2026-04-13",
          recordCount: 1
        }}
        onSelectRefinery={onSelectRefinery}
        refineries={[refinery]}
        selectedRefineryId={null}
      />
    );

    expect(screen.getByText("Ras Tanura Refinery")).toBeInTheDocument();
    expect(screen.getByText("550,000 bpd")).toBeInTheDocument();
    expect(screen.getByText("Approved spec bootstrap dataset")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ras Tanura Refinery").closest("tr")!);

    expect(onSelectRefinery).toHaveBeenCalledWith(refinery);
  });
});
