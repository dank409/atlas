import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CountryDetailOverlay } from "./CountryDetailOverlay";
import type { CountryProfile } from "../../types/Infrastructure";

const country: CountryProfile = {
  chokepointDependency: "Partial Hormuz hedge via Fujairah bypass.",
  code: "AE",
  keyGrades: ["Murban"],
  name: "United Arab Emirates",
  source: "Curated",
  summary: "Gulf OPEC producer.",
  updated: "2026-04-14"
};

describe("CountryDetailOverlay", () => {
  it("renders UNSCORED exposure fields when no country exposure entry is provided", () => {
    render(
      <CountryDetailOverlay
        country={country}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("SEABORNE EXPORTS")).toBeInTheDocument();
    expect(screen.getByText("MODELED AT-RISK")).toBeInTheDocument();
    expect(screen.getAllByText("UNSCORED").length).toBeGreaterThanOrEqual(3);
  });
});
