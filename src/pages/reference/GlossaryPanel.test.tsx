import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlossaryPanel } from "./GlossaryPanel";

describe("GlossaryPanel", () => {
  it("renders a curated set of oil-market terms", () => {
    render(<GlossaryPanel />);
    expect(screen.getByText("OIL-MARKET GLOSSARY")).toBeDefined();
    expect(screen.getByText("Backwardation")).toBeDefined();
    expect(screen.getByText("Contango")).toBeDefined();
    expect(screen.getByText("VLCC")).toBeDefined();
    expect(screen.getByText("Chokepoint")).toBeDefined();
  });
});
