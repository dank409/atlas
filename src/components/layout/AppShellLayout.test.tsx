import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShellLayout } from "./AppShellLayout";

function controls(isOpen: boolean, onToggle = vi.fn()) {
  return { content: <div>CONTROLS CONTENT</div>, isOpen, label: "controls", onToggle };
}

describe("AppShellLayout", () => {
  it("renders header, controls, main content, detail column and status bar", () => {
    render(
      <AppShellLayout
        header={<div>HEADER</div>}
        leftSidebar={controls(true)}
        mainContent={<div>MAIN</div>}
        rightSidebar={<div>DETAIL</div>}
        statusBar={<div>STATUS</div>}
      />
    );

    expect(screen.getByRole("banner")).toHaveTextContent("HEADER");
    expect(screen.getByRole("main")).toHaveTextContent("MAIN");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("STATUS");
    expect(screen.getByText("CONTROLS CONTENT")).toBeInTheDocument();
    expect(screen.getByText("DETAIL")).toBeInTheDocument();
    expect(screen.getAllByRole("complementary")).toHaveLength(2);
  });

  it("renders no side columns when none are passed", () => {
    render(<AppShellLayout header={<div>HEADER</div>} mainContent={<div>MAIN</div>} statusBar={<div>STATUS</div>} />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("hides collapsed controls behind an expand button", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AppShellLayout
        header={<div>HEADER</div>}
        leftSidebar={controls(false, onToggle)}
        mainContent={<div>MAIN</div>}
        statusBar={<div>STATUS</div>}
      />
    );

    expect(screen.queryByText("CONTROLS CONTENT")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand controls sidebar" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("offers a collapse button on open controls", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AppShellLayout
        header={<div>HEADER</div>}
        leftSidebar={controls(true, onToggle)}
        mainContent={<div>MAIN</div>}
        statusBar={<div>STATUS</div>}
      />
    );

    await user.click(screen.getByRole("button", { name: "Collapse controls sidebar" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
