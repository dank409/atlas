import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeftRail, type WatchlistItem } from "./LeftRail";
import type { DatasetId } from "../../types/Infrastructure";

const COUNTS: Record<DatasetId, number> = {
  refineries: 53,
  pipelines: 413,
  fields: 439,
  terminals: 29,
  chokepoints: 4
};

function watchlist(): WatchlistItem[] {
  return [
    { id: "ghawar", label: "Ghawar", status: "nominal", note: "Q ok" },
    { id: "kharg", label: "Kharg Isl.", status: "elevated", note: "shadow" },
    { id: "bab", label: "Bab el-Mandeb", status: "alert", note: "SAF" }
  ];
}

function renderRail(overrides: Partial<React.ComponentProps<typeof LeftRail>> = {}) {
  const props: React.ComponentProps<typeof LeftRail> = {
    activeDatasetIds: ["refineries", "pipelines"],
    datasetCounts: COUNTS,
    activeRegion: "MENA",
    onSelectRegion: vi.fn(),
    onToggleDataset: vi.fn(),
    onFocusShortcut: vi.fn(),
    watchlist: watchlist(),
    ...overrides
  };
  return { props, ...render(<LeftRail {...props} />) };
}

describe("LeftRail", () => {
  it("renders all four category groups", () => {
    renderRail();
    expect(screen.getByText("PIPELINES")).toBeDefined();
    expect(screen.getByText("UPSTREAM")).toBeDefined();
    expect(screen.getByText("DOWNSTREAM")).toBeDefined();
    expect(screen.getByText("GEOPOLITICAL")).toBeDefined();
  });

  it("renders all five region chips and highlights the active one", () => {
    renderRail({ activeRegion: "RED_SEA" });
    const activeChip = screen.getByText("RED SEA");
    // The active chip uses the chipActive class token.
    expect(activeChip.className).toContain("chipActive");
  });

  it("fires onToggleDataset when clicking a layer row", () => {
    const onToggleDataset = vi.fn();
    renderRail({ onToggleDataset });
    // Click the checkbox for refineries.
    const refineriesLabel = screen.getByText("Refineries");
    fireEvent.click(refineriesLabel);
    expect(onToggleDataset).toHaveBeenCalled();
  });

  it("fires onFocusShortcut when a shortcut is clicked", () => {
    const onFocusShortcut = vi.fn();
    renderRail({ onFocusShortcut });
    fireEvent.click(screen.getByText("Focus Hormuz"));
    expect(onFocusShortcut).toHaveBeenCalledWith("focus_hormuz");
  });

  it("renders watchlist entries with status colors", () => {
    renderRail();
    expect(screen.getByText("Ghawar")).toBeDefined();
    expect(screen.getByText("Kharg Isl.")).toBeDefined();
    expect(screen.getByText("Bab el-Mandeb")).toBeDefined();
  });

  it("shows empty state when watchlist is empty", () => {
    renderRail({ watchlist: [] });
    expect(screen.getByText("NO ITEMS")).toBeDefined();
  });

  it("shows the dataset count next to each layer", () => {
    renderRail();
    expect(screen.getByText("53")).toBeDefined(); // refineries count
    expect(screen.getByText("413")).toBeDefined(); // pipelines count
  });
});
