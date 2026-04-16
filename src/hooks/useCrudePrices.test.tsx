import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/eiaPrices", () => ({
  loadCrudePriceSnapshot: vi.fn()
}));

vi.mock("../services/dmeOman", () => ({
  loadDmeOmanSnapshot: vi.fn()
}));

vi.mock("../services/murban", () => ({
  loadMurbanSnapshot: vi.fn()
}));

import { useCrudePrices } from "./useCrudePrices";
import { loadCrudePriceSnapshot } from "../services/eiaPrices";
import { loadDmeOmanSnapshot } from "../services/dmeOman";
import { loadMurbanSnapshot } from "../services/murban";

describe("useCrudePrices", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads once and returns an EOD summary without any polling overlay", async () => {
    vi.mocked(loadCrudePriceSnapshot).mockResolvedValue({
      asOf: "2026-04-14",
      cadence: "EOD",
      classification: "OBSERVED",
      source: "EIA",
      series: {
        brent: [
          { date: "2026-04-13", value: 82.1 },
          { date: "2026-04-14", value: 82.5 }
        ],
        wti: [
          { date: "2026-04-13", value: 78.2 },
          { date: "2026-04-14", value: 78.0 }
        ]
      }
    });
    vi.mocked(loadDmeOmanSnapshot).mockResolvedValue({
      asOf: "2026-04-14",
      cadence: "CURATED",
      classification: "CURATED",
      source: "DME",
      series: {
        dmeOman: [
          { date: "2026-04-13", value: 76.0 },
          { date: "2026-04-14", value: 76.3 }
        ]
      }
    });
    vi.mocked(loadMurbanSnapshot).mockResolvedValue({
      asOf: "2026-04-14",
      cadence: "CURATED",
      classification: "CURATED",
      source: "IFAD",
      series: {
        murban: [
          { date: "2026-04-13", value: 76.7 },
          { date: "2026-04-14", value: 77.0 }
        ]
      }
    });

    const { result } = renderHook(() => useCrudePrices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.summary?.cadence).toBe("EOD");
    expect(result.current.summary?.classification).toBe("OBSERVED");
    expect(result.current.summary?.brentWtiSpread).toBe(4.5);
    expect(result.current.spreadHistory?.series.brentWti).toEqual([
      { date: "2026-04-13", value: 3.9 },
      { date: "2026-04-14", value: 4.5 }
    ]);
    expect(loadCrudePriceSnapshot).toHaveBeenCalledTimes(1);
    expect(loadDmeOmanSnapshot).toHaveBeenCalledTimes(1);
    expect(loadMurbanSnapshot).toHaveBeenCalledTimes(1);
  });
});
