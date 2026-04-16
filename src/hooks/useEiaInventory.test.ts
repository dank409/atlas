import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/eiaInventory", () => ({
  loadEiaWeeklyInventorySnapshot: vi.fn()
}));

import { useEiaInventory } from "./useEiaInventory";
import { loadEiaWeeklyInventorySnapshot } from "../services/eiaInventory";

describe("useEiaInventory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads once and exposes the latest weekly inventory summary alongside the snapshot", async () => {
    vi.mocked(loadEiaWeeklyInventorySnapshot).mockResolvedValue({
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
    });

    const { result } = renderHook(() => useEiaInventory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.latest?.date).toBe("2026-04-15");
    expect(result.current.latest?.deltaVsAverage).toBe(0.3);
    expect(result.current.snapshot?.cadence).toBe("WEEKLY");
    expect(loadEiaWeeklyInventorySnapshot).toHaveBeenCalledTimes(1);
  });
});
