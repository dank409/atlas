import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterSelect } from "./FilterSelect";

const OPTIONS = [
  { count: 151, label: "Iraq", value: "IQ" },
  { count: 106, label: "Saudi Arabia", value: "SA" },
  { count: 13, label: "Turkey", value: "TR" }
];

function renderSelect(overrides: { isSearchable?: boolean; value?: string | null } = {}) {
  const onChange = vi.fn();

  render(
    <div>
      <FilterSelect label="COUNTRY" onChange={onChange} options={OPTIONS} value={null} {...overrides} />
      <button type="button">ELSEWHERE</button>
    </div>
  );
  return onChange;
}

function optionLabels() {
  return within(screen.getByRole("listbox", { name: "COUNTRY" }))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("FilterSelect", () => {
  it("shows the filter's name and current choice, with the list closed", () => {
    renderSelect({ value: "SA" });

    expect(screen.getByRole("button", { name: "COUNTRY: Saudi Arabia" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a list of ALL plus every option with its count, and marks the current choice", async () => {
    const user = userEvent.setup();
    renderSelect({ value: "SA" });

    await user.click(screen.getByRole("button", { name: "COUNTRY: Saudi Arabia" }));

    expect(optionLabels()).toEqual(["ALL", "Iraq151", "Saudi Arabia106", "Turkey13"]);
    expect(screen.getByRole("option", { name: /Saudi Arabia/ })).toHaveAttribute("aria-selected", "true");
  });

  it("reports a pick and closes", async () => {
    const user = userEvent.setup();
    const onChange = renderSelect();

    await user.click(screen.getByRole("button", { name: "COUNTRY: ALL" }));
    await user.click(screen.getByRole("option", { name: /Iraq/ }));

    expect(onChange).toHaveBeenCalledWith("IQ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reports no filter when ALL is picked", async () => {
    const user = userEvent.setup();
    const onChange = renderSelect({ value: "IQ" });

    await user.click(screen.getByRole("button", { name: "COUNTRY: Iraq" }));
    await user.click(screen.getByRole("option", { name: "ALL" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("works from the keyboard: arrows to open and move, Enter to pick", async () => {
    const user = userEvent.setup();
    const onChange = renderSelect();

    screen.getByRole("button", { name: "COUNTRY: ALL" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("SA");
    expect(screen.getByRole("button", { name: "COUNTRY: ALL" })).toHaveFocus();
  });

  it("closes on Escape or a click elsewhere without changing anything", async () => {
    const user = userEvent.setup();
    const onChange = renderSelect();
    const trigger = screen.getByRole("button", { name: "COUNTRY: ALL" });

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "ELSEWHERE" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("narrows a long list as you type, and Enter picks the first match", async () => {
    const user = userEvent.setup();
    const onChange = renderSelect({ isSearchable: true });

    await user.click(screen.getByRole("button", { name: "COUNTRY: ALL" }));
    await user.type(screen.getByRole("textbox", { name: "Narrow the country list" }), "tur");

    expect(optionLabels()).toEqual(["Turkey13"]);

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("TR");
  });

  it("says so when nothing matches what was typed", async () => {
    const user = userEvent.setup();
    renderSelect({ isSearchable: true });

    await user.click(screen.getByRole("button", { name: "COUNTRY: ALL" }));
    await user.type(screen.getByRole("textbox", { name: "Narrow the country list" }), "zzz");

    expect(screen.getByText("NO MATCHES")).toBeInTheDocument();
  });
});
