import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutPage } from "./AboutPage";

describe("AboutPage", () => {
  it("renders the project thesis + non-goals sections", () => {
    render(<AboutPage />);
    expect(screen.getByText("ATLAS / ABOUT")).toBeDefined();
    expect(screen.getByText("THESIS")).toBeDefined();
    expect(screen.getByText("SCOPE")).toBeDefined();
    expect(screen.getByText("NON-GOALS")).toBeDefined();
    expect(screen.getByText("DATA INTEGRITY")).toBeDefined();
  });
});
