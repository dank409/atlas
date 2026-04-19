import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapPage } from "./MapPage";
import { DEFAULT_MAP_DISPLAY_SETTINGS } from "../types/mapDisplaySettings";
import { DEFAULT_BYPASS_CONSTANTS, runBypassScenario } from "../utils/bypassModel";
import { IDLE_SCENARIO_VISUAL_STATE } from "../utils/scenarioMapStyles";

// Mock the MapView so we don't pull mapbox-gl into the test bundle.
vi.mock("../components/map/MapView", () => ({
  MapView: () => <div>MAP VIEW MOUNTED</div>,
  BASEMAP_MODE_LABELS: { dark: "DARK", satellite: "SAT", firms: "FIRMS" }
}));

// Also mock MapWorkspaceMain since MapPage dynamically imports it.
vi.mock("../components/layout/MapWorkspaceMain", () => ({
  MapWorkspaceMain: ({ onSelectBasemap }: { onSelectBasemap: (mode: "dark") => void }) => (
    <div>
      MAP WORKSPACE MOUNTED
      <button onClick={() => onSelectBasemap("dark")} type="button">
        TRIGGER BASEMAP
      </button>
    </div>
  )
}));

describe("MapPage", () => {
  it("renders the lazy map workspace", async () => {
    render(
      <MapPage
        activeDatasetIds={[]}
        appendActivity={vi.fn()}
        basemapMode="dark"
        firmsSnapshot={null}
        gridDatasetId={null}
        gridRows={[]}
        hasError={false}
        isAssetGridOpen
        latestUpdate="2026-04-19"
        mapDisplaySettings={DEFAULT_MAP_DISPLAY_SETTINGS}
        onClearSelection={vi.fn()}
        onInspectAsset={vi.fn()}
        onSelectAsset={vi.fn()}
        onSelectBasemap={vi.fn()}
        onToggleAssetGrid={vi.fn()}
        outageEvents={null}
        regionalSnapshot={{
          bypassResult: runBypassScenario({ disruptionPct: 0 }),
          disruptionPct: 0,
          firmsAlertCount: 0,
          hormuzBaselineMbpd: DEFAULT_BYPASS_CONSTANTS.hormuzCrudeFlowMbpd
        }}
        scenarioState={IDLE_SCENARIO_VISUAL_STATE}
        selectedAssetId={null}
        visibleAssets={[]}
      />
    );
    expect(await screen.findByText("MAP WORKSPACE MOUNTED")).toBeInTheDocument();
  });
});
