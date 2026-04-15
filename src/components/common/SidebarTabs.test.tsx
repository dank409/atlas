import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarTabs } from "./SidebarTabs";

describe("SidebarTabs", () => {
  it("marks the active option with aria-selected and renders both labels", () => {
    render(
      <SidebarTabs
        active="catalog"
        ariaLabel="Left sidebar mode"
        onChange={() => {}}
        options={[
          { value: "catalog", label: "CATALOG" },
          { value: "scenarios", label: "SCENARIOS" }
        ]}
      />
    );

    const catalog = screen.getByRole("tab", { name: /CATALOG/ });
    const scenarios = screen.getByRole("tab", { name: /SCENARIOS/ });

    expect(catalog).toHaveAttribute("aria-selected", "true");
    expect(scenarios).toHaveAttribute("aria-selected", "false");
  });

  it("emits the new value when a different tab is clicked", () => {
    const onChange = vi.fn();
    render(
      <SidebarTabs
        active="catalog"
        ariaLabel="Left sidebar mode"
        onChange={onChange}
        options={[
          { value: "catalog", label: "CATALOG" },
          { value: "scenarios", label: "SCENARIOS" }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /SCENARIOS/ }));
    expect(onChange).toHaveBeenCalledWith("scenarios");
  });

  it("renders an optional badge alongside the label", () => {
    render(
      <SidebarTabs
        active="scenarios"
        ariaLabel="Left sidebar mode"
        onChange={() => {}}
        options={[
          { value: "catalog", label: "CATALOG" },
          { value: "scenarios", label: "SCENARIOS", badge: "ACTIVE" }
        ]}
      />
    );

    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });
});
