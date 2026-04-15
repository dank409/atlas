import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShellLayout } from "./AppShellLayout";

function renderShell(overrides: { isRightSidebarOpen?: boolean; withTape?: boolean } = {}) {
  return render(
    <AppShellLayout
      header={<div data-testid="hdr">HEADER</div>}
      isRightSidebarOpen={overrides.isRightSidebarOpen ?? true}
      leftSidebar={<div data-testid="left">LEFT</div>}
      mainContent={<div data-testid="main">MAIN</div>}
      marketTape={overrides.withTape ? <div data-testid="tape">TAPE</div> : undefined}
      rightSidebar={<div data-testid="right">RIGHT</div>}
      statusBar={<div data-testid="status">STATUS</div>}
    >
      <div data-testid="overlay">OVERLAY</div>
    </AppShellLayout>
  );
}

describe("AppShellLayout", () => {
  it("renders header, sidebars, main, status bar, and overlay children", () => {
    renderShell();

    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("main")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
    expect(screen.getByTestId("status")).toBeInTheDocument();
    expect(screen.getByTestId("overlay")).toBeInTheDocument();
  });

  it("hides the right sidebar when isRightSidebarOpen is false", () => {
    renderShell({ isRightSidebarOpen: false });

    expect(screen.queryByTestId("right")).not.toBeInTheDocument();
    // Main content still renders in the collapsed state.
    expect(screen.getByTestId("main")).toBeInTheDocument();
  });

  it("renders the market tape region only when provided", () => {
    const { rerender } = renderShell();
    expect(screen.queryByTestId("tape")).not.toBeInTheDocument();

    rerender(
      <AppShellLayout
        header={<div>h</div>}
        leftSidebar={<div>l</div>}
        mainContent={<div>m</div>}
        marketTape={<div data-testid="tape">TAPE</div>}
        rightSidebar={<div>r</div>}
        statusBar={<div>s</div>}
      />
    );
    expect(screen.getByTestId("tape")).toBeInTheDocument();
  });
});
