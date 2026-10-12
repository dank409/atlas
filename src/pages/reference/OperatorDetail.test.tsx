import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OperatorDetail } from "./OperatorDetail";
import { makePipeline, makeRefinery } from "../../test/fixtures";
import type { OperatorEntry } from "../../utils/referenceIndex";

const eastWest = makePipeline();
const rasTanura = makeRefinery({ capacity_bpd: 550000, id: "ras-tanura", name: "Ras Tanura Refinery" });

const ARAMCO: OperatorEntry = {
  assets: [eastWest, rasTanura],
  countryCodes: ["SA", "BH"],
  id: "saudi-aramco",
  name: "Saudi Aramco",
  pipelineLengthKm: 1200,
  profile: {
    domicile: "Saudi Arabia",
    id: "saudi-aramco",
    name: "Saudi Aramco",
    source: "EIA Country Analysis Brief: Saudi Arabia (October 2024)",
    summary: "State oil company of Saudi Arabia.",
    updated: "2026-10-10",
    website: "www.aramco.com"
  },
  refiningCapacityBpd: 550000
};

function renderDetail(operator: OperatorEntry = ARAMCO) {
  const props = {
    countryNameByCode: { BH: "Bahrain", SA: "Saudi Arabia" },
    onNavigate: vi.fn(),
    onSelectAsset: vi.fn(),
    onShowOnMap: vi.fn(),
    operator
  };

  render(<OperatorDetail {...props} />);
  return props;
}

describe("OperatorDetail", () => {
  it("summarises the operator's assets from the map data", () => {
    renderDetail();

    expect(screen.getByRole("region", { name: "OPERATOR Saudi Aramco" })).toBeInTheDocument();
    expect(screen.getByText("Refining cap.").parentElement).toHaveTextContent("550,000 BPD");
    expect(screen.getByText("1,200 KM")).toBeInTheDocument();
    expect(
      screen.getByText("SOURCES: GLOBAL ENERGY MONITOR · EDF OGIM · OPENSTREETMAP · EIA Country Analysis Brief: Saudi Arabia (October 2024)")
    ).toBeInTheDocument();
  });

  it("links to each country it has assets in", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: "Bahrain" }));

    expect(props.onNavigate).toHaveBeenCalledWith("countries", "BH");
  });

  it("offers to show everything the operator has on the map", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: /SHOW ON MAP/ }));

    expect(props.onShowOnMap).toHaveBeenCalledTimes(1);
  });

  it("links each asset to the map", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByRole("button", { name: /East-West Crude Oil Pipeline/ }));

    expect(props.onSelectAsset).toHaveBeenCalledWith(eastWest);
  });

  it("shows a background note, and credits its source, only for operators that have one", () => {
    const { unmount } = render(
      <OperatorDetail
        countryNameByCode={{}}
        onNavigate={vi.fn()}
        onSelectAsset={vi.fn()}
        onShowOnMap={vi.fn()}
        operator={ARAMCO}
      />
    );
    expect(screen.getByText("State oil company of Saudi Arabia.")).toBeInTheDocument();
    unmount();

    renderDetail({ ...ARAMCO, profile: null });
    expect(screen.queryByText("BACKGROUND")).not.toBeInTheDocument();
    expect(screen.getByText("SOURCES: GLOBAL ENERGY MONITOR · EDF OGIM · OPENSTREETMAP")).toBeInTheDocument();
  });

  it("omits totals that do not apply", () => {
    renderDetail({ ...ARAMCO, assets: [rasTanura], pipelineLengthKm: 0 });

    expect(screen.queryByText("Pipeline length")).not.toBeInTheDocument();
  });
});
