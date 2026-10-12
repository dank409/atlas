import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GradeDetail } from "./GradeDetail";
import { makeField } from "../../test/fixtures";
import type { CrudeGrade } from "../../types/CrudeGrade";

const ARAB_HEAVY: CrudeGrade = {
  apiGravity: 27.4,
  id: "arab-heavy",
  name: "Arab Heavy",
  note: "From Safaniya.",
  producer: "Saudi Arabia",
  producerIso: "SAU",
  source: "Wikipedia: List of crude oil products",
  sulfurPct: 2.9
};
const ARAB_LIGHT = { ...ARAB_HEAVY, id: "arab-light", name: "Arab Light" };
const safaniya = makeField({ id: "safaniya", name: "Safaniya Oil and Gas Field (Saudi Arabia)" });

type DataProps = Pick<Parameters<typeof GradeDetail>[0], "countryCode" | "mentionedAssets" | "siblingGrades">;

function renderDetail(overrides: Partial<DataProps> = {}) {
  // Kept out of `overrides` so they stay typed as mocks.
  const handlers = { onNavigate: vi.fn(), onSelectAsset: vi.fn() };

  render(
    <GradeDetail
      countryCode="SA"
      grade={ARAB_HEAVY}
      mentionedAssets={[safaniya]}
      siblingGrades={[ARAB_LIGHT]}
      {...overrides}
      {...handlers}
    />
  );
  return handlers;
}

describe("GradeDetail", () => {
  it("renders the assay figures with units and credits their source", () => {
    renderDetail();

    expect(screen.getByRole("region", { name: "CRUDE GRADE Arab Heavy" })).toBeInTheDocument();
    expect(screen.getByText("27.4°")).toBeInTheDocument();
    expect(screen.getByText("2.90%")).toBeInTheDocument();
    expect(screen.getByText("SOURCE: Wikipedia: List of crude oil products")).toBeInTheDocument();
  });

  it("links to the producing country, sibling grades and glossary terms", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: "Saudi Arabia ▸" }));
    await user.click(screen.getByRole("button", { name: "Arab Light" }));
    await user.click(screen.getByRole("button", { name: "API gravity" }));

    expect(props.onNavigate.mock.calls).toEqual([
      ["countries", "SA"],
      ["grades", "arab-light"],
      ["glossary", "API gravity"]
    ]);
  });

  it("links the fields its note names to the map", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: /Safaniya/ }));

    expect(props.onSelectAsset).toHaveBeenCalledWith(safaniya);
  });

  it("shows the producer as plain text when it has no country entry, and hides empty link sections", () => {
    renderDetail({ countryCode: null, mentionedAssets: [], siblingGrades: [] });

    expect(screen.queryByRole("button", { name: "Saudi Arabia ▸" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /NAMED IN THE NOTE/ })).not.toBeInTheDocument();
    expect(screen.getByText("None in the table.")).toBeInTheDocument();
  });
});
