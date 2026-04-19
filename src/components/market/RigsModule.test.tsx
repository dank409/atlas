import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RigsModule } from "./RigsModule";
import type { RigCountSnapshot } from "../../types/Rigs";

function snapshot(): RigCountSnapshot {
  return {
    asOf: "2026-04-10",
    cadence: "WEEKLY",
    classification: "CURATED",
    source: "Baker Hughes",
    regions: [
      { country: "United States", code: "US", cadence: "WEEKLY", asOf: "2026-04-10", value: 596, change: -3 },
      { country: "Saudi Arabia", code: "SA", cadence: "MONTHLY", asOf: "2026-03-31", value: 75, change: 0 },
      { country: "United Arab Emirates", code: "AE", cadence: "MONTHLY", asOf: "2026-03-31", value: 52, change: 1 }
    ]
  };
}

describe("RigsModule", () => {
  it("renders an empty state when snapshot is null", () => {
    render(<RigsModule snapshot={null} />);
    expect(screen.getByText("NO RIG COUNT DATA")).toBeDefined();
  });

  it("renders one row per region with value and signed change", () => {
    render(<RigsModule snapshot={snapshot()} />);
    expect(screen.getByText("United States")).toBeDefined();
    expect(screen.getByText("596")).toBeDefined();
    expect(screen.getByText("-3")).toBeDefined();
    expect(screen.getByText("Saudi Arabia")).toBeDefined();
    expect(screen.getByText("75")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByText("+1")).toBeDefined();
  });

  it("puts MENA rows before North America rows when meFocus is true", () => {
    const { container } = render(<RigsModule meFocus snapshot={snapshot()} />);
    // Query only the labeled country spans (the `.label` or
    // `.labelMe` spans are the top-most text per row). This avoids
    // matching the parent `.rows` container whose textContent holds
    // every row concatenated.
    const labels = container.querySelectorAll("[class*='label']");
    const labelTexts = Array.from(labels).map((l) => l.textContent || "");
    const saIdx = labelTexts.findIndex((t) => t === "Saudi Arabia");
    const usIdx = labelTexts.findIndex((t) => t === "United States");
    expect(saIdx).toBeGreaterThanOrEqual(0);
    expect(usIdx).toBeGreaterThanOrEqual(0);
    expect(saIdx).toBeLessThan(usIdx);
  });

  it("renders the source + asOf footer", () => {
    render(<RigsModule snapshot={snapshot()} />);
    expect(screen.getByText("Baker Hughes")).toBeDefined();
    expect(screen.getByText("AS OF 2026-04-10")).toBeDefined();
  });
});
