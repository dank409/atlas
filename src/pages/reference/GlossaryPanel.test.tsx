import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GlossaryPanel } from "./GlossaryPanel";

function renderGlossary(highlightedTerm: string | null = null) {
  const props = { highlightedTerm, onNavigate: vi.fn(), onOpenTable: vi.fn() };

  render(<GlossaryPanel {...props} />);
  return props;
}

function entryOf(term: string) {
  return screen.getByText(term).closest("div") as HTMLElement;
}

describe("GlossaryPanel", () => {
  it("explains the units the app shows", () => {
    renderGlossary();

    for (const unit of ["BPD", "BOE/D", "MTPA"]) {
      expect(screen.getByText(unit)).toBeInTheDocument();
    }
  });

  it("explains the infrastructure and crude-quality terms the app uses", () => {
    renderGlossary();

    for (const term of ["Refinery", "LNG", "NGL", "FSRU", "API gravity", "Sulfur content"]) {
      expect(screen.getByText(term)).toBeInTheDocument();
    }
  });

  it("leaves out trading jargon and features the app does not have", () => {
    renderGlossary();

    expect(screen.queryByText("Backwardation")).not.toBeInTheDocument();
    expect(screen.queryByText("Crack spread")).not.toBeInTheDocument();
    expect(screen.queryByText("OSP")).not.toBeInTheDocument();
    expect(screen.queryByText(/bypass model/i)).not.toBeInTheDocument();
  });

  it("links terms to where they are used: a table layer or another reference tab", async () => {
    const user = userEvent.setup();
    const props = renderGlossary();

    await user.click(entryOf("Refinery").querySelector("button") as HTMLElement);
    await user.click(entryOf("API gravity").querySelector("button") as HTMLElement);
    await user.click(entryOf("Chokepoint").querySelector("button") as HTMLElement);

    expect(props.onOpenTable).toHaveBeenCalledWith("refineries");
    expect(props.onNavigate.mock.calls).toEqual([["grades"], ["countries"]]);
  });

  it("outlines only the term a link pointed at", () => {
    renderGlossary("API gravity");

    expect(entryOf("API gravity").className).toMatch(/entryHighlighted/);
    expect(entryOf("Sulfur content").className).not.toMatch(/entryHighlighted/);
  });
});
