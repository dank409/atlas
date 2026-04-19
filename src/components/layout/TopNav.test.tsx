import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "./TopNav";
import { VIEW_REGISTRY } from "../../types/View";

function renderTopNav(overrides: Partial<React.ComponentProps<typeof TopNav>> = {}) {
  const props: React.ComponentProps<typeof TopNav> = {
    activeView: "map",
    isScenarioActive: false,
    scenarioDisruptionPct: 0,
    onChangeView: vi.fn(),
    onCommandSubmit: vi.fn(),
    onSearchQueryChange: vi.fn(),
    onSelectSearchResult: vi.fn(),
    searchQuery: "",
    searchResults: [],
    localTime: "14:07:00",
    utcTime: "14:07:00",
    sessionDate: "19 APR 2026",
    ...overrides
  };
  return { props, ...render(<TopNav {...props} />) };
}

describe("TopNav", () => {
  it("renders every view tab from the registry", () => {
    renderTopNav();
    for (const descriptor of VIEW_REGISTRY) {
      expect(screen.getByText(descriptor.label)).toBeDefined();
    }
  });

  it("marks the active tab with aria-current=page", () => {
    renderTopNav({ activeView: "markets" });
    const marketsButton = screen.getByText("MARKETS");
    expect(marketsButton.getAttribute("aria-current")).toBe("page");
  });

  it("fires onChangeView when a tab is clicked", () => {
    const onChangeView = vi.fn();
    renderTopNav({ onChangeView });
    fireEvent.click(screen.getByText("MODELS"));
    expect(onChangeView).toHaveBeenCalledWith("models");
  });

  it("shows the scenario badge only when scenario is active", () => {
    const { rerender, props } = renderTopNav();
    expect(screen.queryByText(/SCENARIO/)).toBeNull();
    rerender(<TopNav {...props} isScenarioActive scenarioDisruptionPct={60} />);
    expect(screen.getByText(/SCENARIO · HORMUZ 60%/)).toBeDefined();
  });

  it("renders both clocks and the session date", () => {
    renderTopNav({ localTime: "09:42:17", utcTime: "08:42:17", sessionDate: "19 APR 2026" });
    expect(screen.getByText("09:42:17")).toBeDefined();
    expect(screen.getByText("08:42:17")).toBeDefined();
    expect(screen.getByText("19 APR 2026")).toBeDefined();
  });

  it("submits the command bar on form submit", () => {
    const onCommandSubmit = vi.fn();
    renderTopNav({ onCommandSubmit, searchQuery: "chokes" });
    const input = screen.getByLabelText("Command or search");
    const form = input.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(onCommandSubmit).toHaveBeenCalledWith("chokes");
  });
});
