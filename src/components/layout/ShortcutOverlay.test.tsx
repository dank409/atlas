import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortcutOverlay } from "./ShortcutOverlay";

describe("ShortcutOverlay", () => {
  it("renders under the SHORTCUTS aria label", () => {
    render(<ShortcutOverlay />);

    expect(screen.getByRole("region", { name: "SHORTCUTS" })).toBeInTheDocument();
  });

  it("lists the core view, dataset, and command-bar shortcuts", () => {
    render(<ShortcutOverlay />);

    expect(screen.getByText("MAP VIEW")).toBeInTheDocument();
    expect(screen.getByText("TABLE VIEW")).toBeInTheDocument();
    expect(screen.getByText("DASH VIEW")).toBeInTheDocument();
    expect(screen.getByText("TOGGLE REFINERIES")).toBeInTheDocument();
    expect(screen.getByText("TOGGLE CHOKEPOINTS")).toBeInTheDocument();
    expect(screen.getByText("FOCUS COMMAND BAR")).toBeInTheDocument();
    expect(screen.getByText("TOGGLE RIGHT RAIL")).toBeInTheDocument();
    expect(screen.getByText("OPEN SHORTCUTS")).toBeInTheDocument();
  });

  it("renders each shortcut key glyph", () => {
    render(<ShortcutOverlay />);

    for (const key of ["M", "T", "D", "1", "5", "/", "ESC", "]", "?"]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });
});
