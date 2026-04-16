import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/iceSettlements", () => ({
  loadIceBrentSettlementSnapshot: vi.fn()
}));

import { useIceSettlements } from "./useIceSettlements";
import { loadIceBrentSettlementSnapshot } from "../services/iceSettlements";

describe("useIceSettlements", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads once and exposes derived prompt timespreads", async () => {
    vi.mocked(loadIceBrentSettlementSnapshot).mockResolvedValue({
      asOf: "2026-04-14",
      cadence: "EOD",
      classification: "CURATED",
      source: "ICE Brent settlements",
      strip: [
        { month: 1, contractCode: "BRN M1", priceUsd: 77.35 },
        { month: 2, contractCode: "BRN M2", priceUsd: 75.8 },
        { month: 3, contractCode: "BRN M3", priceUsd: 74.9 },
        { month: 4, contractCode: "BRN M4", priceUsd: 73.9 },
        { month: 5, contractCode: "BRN M5", priceUsd: 72.6 },
        { month: 6, contractCode: "BRN M6", priceUsd: 71.15 },
        { month: 7, contractCode: "BRN M7", priceUsd: 70.5 },
        { month: 8, contractCode: "BRN M8", priceUsd: 69.8 },
        { month: 9, contractCode: "BRN M9", priceUsd: 69.1 },
        { month: 10, contractCode: "BRN M10", priceUsd: 68.4 },
        { month: 11, contractCode: "BRN M11", priceUsd: 67.8 },
        { month: 12, contractCode: "BRN M12", priceUsd: 67.1 }
      ]
    });

    const { result } = renderHook(() => useIceSettlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.timespreads?.m1MinusM2).toBe(1.55);
    expect(result.current.timespreads?.m1MinusM6).toBe(6.2);
    expect(result.current.timespreads?.structure).toBe("BACKWARDATION");
    expect(loadIceBrentSettlementSnapshot).toHaveBeenCalledTimes(1);
  });
});
