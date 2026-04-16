import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InventoryChart } from "./InventoryChart";
import type { EiaWeeklyInventorySnapshot } from "../../types/Market";

const snapshot: EiaWeeklyInventorySnapshot = {
  asOf: "2026-04-15",
  cadence: "WEEKLY",
  classification: "OBSERVED",
  latest: {
    date: "2026-04-15",
    value: 421.8,
    fiveYearAverage: 421.5,
    fiveYearMin: 394.2,
    fiveYearMax: 432.7,
    deltaVsAverage: 0.3,
    deltaPctVsAverage: 0.07,
    rangePosition: 0.717,
    rangePositionLabel: "WITHIN_RANGE"
  },
  source: "EIA",
  seriesName: "US Commercial Crude Excluding SPR",
  units: "million_barrels",
  series: [
    {
      date: "2026-04-08",
      value: 423.6,
      fiveYearAverage: 422.2,
      fiveYearMin: 394.8,
      fiveYearMax: 434.1
    },
    {
      date: "2026-04-15",
      value: 421.8,
      fiveYearAverage: 421.5,
      fiveYearMin: 394.2,
      fiveYearMax: 432.7
    }
  ]
};

describe("InventoryChart", () => {
  it("renders the latest inventory summary and 5Y range context", () => {
    render(<InventoryChart snapshot={snapshot} />);

    expect(screen.getByText("US CRUDE INVENTORIES")).toBeInTheDocument();
    expect(screen.getByText("421.8 MMBBL")).toBeInTheDocument();
    expect(screen.getByText("+0.3 MMBBL")).toBeInTheDocument();
    expect(screen.getByText("72% OF 5Y RANGE")).toBeInTheDocument();
    expect(screen.getByText(/OBSERVED \| WEEKLY \| SOURCE: EIA \| AS OF 2026-04-15 \| LATEST WEEK 2026-04-15/)).toBeInTheDocument();
  });
});
