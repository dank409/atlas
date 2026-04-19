import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AisPage } from "./AisPage";

describe("AisPage", () => {
  it("renders an honest AWAITING FEED placeholder rather than fabricated vessel data", () => {
    render(<AisPage />);
    expect(screen.getByText("AIS WATCH")).toBeDefined();
    expect(screen.getByText("AWAITING FEED")).toBeDefined();
    expect(screen.getByText(/AISSTREAM.IO — NOT WIRED/i)).toBeDefined();
  });
});
