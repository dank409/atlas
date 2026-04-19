import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowsPage } from "./FlowsPage";

describe("FlowsPage", () => {
  it("renders an honest AWAITING FEED placeholder for the Sankey view", () => {
    render(<FlowsPage />);
    expect(screen.getByText("CRUDE FLOWS")).toBeDefined();
    expect(screen.getByText("AWAITING FEED")).toBeDefined();
  });
});
