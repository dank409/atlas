import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataPage } from "./DataPage";

describe("DataPage", () => {
  it("renders the data-source manifest with LIVE / STATIC / AWAITING counts", () => {
    render(<DataPage />);
    expect(screen.getByText("DATA · SOURCES")).toBeDefined();
    // Each status pill renders at least once in the table body.
    expect(screen.getAllByText("LIVE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("STATIC SNAPSHOT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AWAITING FEED").length).toBeGreaterThan(0);
  });

  it("lists at least the EIA, FIRMS, and AISStream rows", () => {
    render(<DataPage />);
    expect(screen.getByText(/EIA Brent/)).toBeDefined();
    expect(screen.getByText(/NASA FIRMS/)).toBeDefined();
    expect(screen.getByText(/AISStream/)).toBeDefined();
  });
});
