import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PagePlaceholder } from "./PagePlaceholder";

describe("PagePlaceholder", () => {
  it("renders title + status line + AWAITING FEED badge", () => {
    render(
      <PagePlaceholder
        dependencies={["dep-a", "dep-b"]}
        phase="VIEW · AIS"
        statusLine="LIVE — NOT WIRED"
        summary="Details about the view"
        title="AIS WATCH"
      />
    );
    expect(screen.getByText("AIS WATCH")).toBeDefined();
    expect(screen.getByText("AWAITING FEED")).toBeDefined();
    expect(screen.getByText("VIEW · AIS")).toBeDefined();
    expect(screen.getByText("LIVE — NOT WIRED")).toBeDefined();
    expect(screen.getByText("dep-a")).toBeDefined();
    expect(screen.getByText("dep-b")).toBeDefined();
  });

  it("renders the optional note when provided", () => {
    render(
      <PagePlaceholder
        dependencies={[]}
        note="Follow-up note text"
        statusLine="stub"
        summary="summary"
        title="X"
      />
    );
    expect(screen.getByText("Follow-up note text")).toBeDefined();
  });
});
