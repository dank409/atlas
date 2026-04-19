import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AisPage } from "./AisPage";

// Stub the AIS stream hook so tests don't open a real WebSocket.
vi.mock("../hooks/useAisStream", () => ({
  useAisStream: vi.fn()
}));

import { useAisStream } from "../hooks/useAisStream";
const useAisStreamMock = useAisStream as unknown as ReturnType<typeof vi.fn>;

describe("AisPage", () => {
  it("renders the placeholder when the API key is missing", () => {
    useAisStreamMock.mockReturnValue({
      positions: [],
      connection: { status: "IDLE" },
      stats: { tankersTracked24h: 0, uniqueMmsiSeen: 0, messagesReceived: 0, msgRatePerMin: 0 },
      disabled: true
    });
    render(<AisPage />);
    expect(screen.getByText("AIS WATCH")).toBeDefined();
    expect(screen.getByText(/API KEY MISSING/i)).toBeDefined();
  });

  it("renders the live positions table when a vessel is in state", () => {
    useAisStreamMock.mockReturnValue({
      positions: [
        {
          id: "311000001",
          mmsi: 311000001,
          vesselName: "New Amorita",
          imo: 9792541,
          sog: 12.4,
          cog: 94,
          lat: 26.12,
          lon: 54.81,
          receivedAt: new Date().toISOString()
        }
      ],
      connection: { status: "OPEN", openedAt: new Date().toISOString() },
      stats: { tankersTracked24h: 1, uniqueMmsiSeen: 1, messagesReceived: 1, msgRatePerMin: 60 },
      disabled: false
    });
    render(<AisPage />);
    expect(screen.getByText("AIS WATCH · LIVE POSITIONS")).toBeDefined();
    expect(screen.getByText("New Amorita")).toBeDefined();
    expect(screen.getAllByText(/LIVE/).length).toBeGreaterThan(0);
  });

  it("shows the connecting empty state when there are no positions yet", () => {
    useAisStreamMock.mockReturnValue({
      positions: [],
      connection: { status: "CONNECTING" },
      stats: { tankersTracked24h: 0, uniqueMmsiSeen: 0, messagesReceived: 0, msgRatePerMin: 0 },
      disabled: false
    });
    render(<AisPage />);
    expect(screen.getByText(/CONNECTING TO AISSTREAM/i)).toBeDefined();
  });
});
