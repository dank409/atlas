import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./Panel";

describe("Panel", () => {
  it("renders title and children", () => {
    render(
      <Panel title="LAYER CONTROLS">
        <p>body copy</p>
      </Panel>
    );

    expect(screen.getByText("LAYER CONTROLS")).toBeInTheDocument();
    expect(screen.getByText("body copy")).toBeInTheDocument();
  });

  it("renders the optional badge when provided", () => {
    render(
      <Panel title="DATASET CATALOG" badge="3 ACTIVE">
        <div>child</div>
      </Panel>
    );

    expect(screen.getByText("3 ACTIVE")).toBeInTheDocument();
  });

  it("omits the badge when not provided", () => {
    render(
      <Panel title="DATASET CATALOG">
        <div>child</div>
      </Panel>
    );

    expect(screen.queryByText(/ACTIVE/)).not.toBeInTheDocument();
  });
});
