import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "./TopNav";
import { makeRefinery } from "../../test/fixtures";
import type { SearchResult } from "../../utils/search";

const ruwais: SearchResult = {
  key: "asset:refinery-ruwais",
  meta: "REFINERY | UNITED ARAB EMIRATES",
  name: "Ruwais Refinery",
  target: { asset: makeRefinery(), kind: "asset" }
};
const saudiArabia: SearchResult = {
  key: "country:SA",
  meta: "COUNTRY | 62 ASSETS",
  name: "Saudi Arabia",
  target: { id: "SA", kind: "reference", tab: "countries" }
};

function renderNav(overrides: Partial<Parameters<typeof TopNav>[0]> = {}) {
  const props = {
    activeView: "map" as const,
    onChangeView: vi.fn(),
    onSearchQueryChange: vi.fn(),
    onSelectSearchResult: vi.fn(),
    searchQuery: "",
    searchResults: [],
    ...overrides
  };

  render(<TopNav {...props} />);
  return props;
}

describe("TopNav", () => {
  it("shows the brand as a mark outside the tab list", () => {
    renderNav();

    expect(screen.getByText("ATLAS").closest("nav")).toBeNull();
  });

  it("shows the four views and marks the active one", () => {
    renderNav({ activeView: "reference" });

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "MAP",
      "TABLE",
      "REFERENCE",
      "ABOUT"
    ]);
    expect(screen.getByRole("button", { name: "REFERENCE" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "MAP" })).not.toHaveAttribute("aria-current");
  });

  it("switches view when a tab is clicked", async () => {
    const user = userEvent.setup();
    const props = renderNav();

    await user.click(screen.getByRole("button", { name: "ABOUT" }));

    expect(props.onChangeView).toHaveBeenCalledWith("about");
  });

  it("reports typing in the search box and hides results while the query is blank", async () => {
    const user = userEvent.setup();
    const props = renderNav({ searchResults: [ruwais] });

    await user.type(screen.getByRole("searchbox", { name: "Search the map and reference" }), "r");

    expect(props.onSearchQueryChange).toHaveBeenCalledWith("r");
    expect(screen.queryByText("Ruwais Refinery")).not.toBeInTheDocument();
  });

  it("lists assets and reference entries with what each one is, and selects on click", async () => {
    const user = userEvent.setup();
    const props = renderNav({ searchQuery: "a", searchResults: [ruwais, saudiArabia] });

    expect(screen.getByText("REFINERY | UNITED ARAB EMIRATES")).toBeInTheDocument();
    expect(screen.getByText("COUNTRY | 62 ASSETS")).toBeInTheDocument();

    await user.click(screen.getByText("Saudi Arabia"));

    expect(props.onSelectSearchResult).toHaveBeenCalledWith(saudiArabia);
  });

  it("selects the first result on Enter", () => {
    const props = renderNav({ searchQuery: "a", searchResults: [ruwais, saudiArabia] });

    fireEvent.submit(screen.getByRole("search"));

    expect(props.onSelectSearchResult).toHaveBeenCalledWith(ruwais);
  });

  it("moves through the results with the arrow keys, and Enter opens the highlighted one", async () => {
    const user = userEvent.setup();
    const props = renderNav({ searchQuery: "a", searchResults: [ruwais, saudiArabia] });
    const searchBox = screen.getByRole("searchbox", { name: "Search the map and reference" });

    // The first result is highlighted to begin with.
    expect(screen.getByText("Ruwais Refinery").closest("button")?.className).toMatch(/searchResultActive/);

    await user.type(searchBox, "{ArrowDown}");
    expect(screen.getByText("Saudi Arabia").closest("button")?.className).toMatch(/searchResultActive/);

    // It stops at the last result rather than wrapping.
    await user.type(searchBox, "{ArrowDown}{Enter}");
    expect(props.onSelectSearchResult).toHaveBeenCalledWith(saudiArabia);

    await user.type(searchBox, "{ArrowUp}{ArrowUp}{Enter}");
    expect(props.onSelectSearchResult).toHaveBeenLastCalledWith(ruwais);
  });

  it("says so when nothing matches, and Enter then does nothing", () => {
    const props = renderNav({ searchQuery: "zzz" });

    expect(screen.getByText("NO MATCHES")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("search"));
    expect(props.onSelectSearchResult).not.toHaveBeenCalled();
  });

  it("clears the query on Escape", async () => {
    const user = userEvent.setup();
    const props = renderNav({ searchQuery: "ruw", searchResults: [ruwais] });

    await user.type(screen.getByRole("searchbox", { name: "Search the map and reference" }), "{Escape}");

    expect(props.onSearchQueryChange).toHaveBeenCalledWith("");
  });
});
