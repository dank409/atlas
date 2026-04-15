import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FirmsAlertFeed } from "./FirmsAlertFeed";
import type {
  FirmsFacilityAnomaly,
  FirmsSnapshot,
  GeofenceableAsset
} from "../../types/firms";

const rasTanura: GeofenceableAsset = {
  id: "refinery-sa-ras-tanura-refinery",
  name: "Ras Tanura Refinery",
  assetType: "refinery",
  center: { lat: 26.65, lon: 50.16 },
  radiusKm: 5,
  owner: "Saudi Aramco",
  capacityBpd: 550000
};

const abadan: GeofenceableAsset = {
  id: "refinery-ir-abadan-refinery",
  name: "Abadan Refinery",
  assetType: "refinery",
  center: { lat: 30.34, lon: 48.3 },
  radiusKm: 5,
  owner: "NIOC",
  capacityBpd: 400000
};

const jeddah: GeofenceableAsset = {
  id: "refinery-sa-jeddah-refinery",
  name: "Jeddah Refinery",
  assetType: "refinery",
  center: { lat: 21.5, lon: 39.2 },
  radiusKm: 5,
  owner: "Saudi Aramco",
  capacityBpd: 100000
};

const yanbu: GeofenceableAsset = {
  id: "refinery-sa-yanbu-refinery",
  name: "Yanbu Refinery",
  assetType: "refinery",
  center: { lat: 24.1, lon: 38.1 },
  radiusKm: 5,
  owner: "Saudi Aramco",
  capacityBpd: 225000
};

const alertAnomaly: FirmsFacilityAnomaly = {
  asset: rasTanura,
  windowCount: 12,
  baselineMean: 2.8,
  baselineStdev: 1.5,
  zScore: 6.13,
  ratioToBaseline: 4.29,
  severity: "ALERT",
  latestDetectionAt: "2026-04-14T10:15:00Z"
};

const elevatedAnomaly: FirmsFacilityAnomaly = {
  asset: abadan,
  windowCount: 5,
  baselineMean: 2.0,
  baselineStdev: 1.2,
  zScore: 2.5,
  ratioToBaseline: 2.5,
  severity: "ELEVATED",
  latestDetectionAt: "2026-04-14T09:00:00Z"
};

const normalAnomaly: FirmsFacilityAnomaly = {
  asset: yanbu,
  windowCount: 1,
  baselineMean: 1.5,
  baselineStdev: 1.0,
  zScore: -0.5,
  ratioToBaseline: 0.67,
  severity: "NORMAL",
  latestDetectionAt: "2026-04-14T08:00:00Z"
};

const snapshot: FirmsSnapshot = {
  mode: "STATIC_SNAPSHOT",
  asOf: "2026-04-14T12:00:00Z",
  windowHours: 72,
  confidenceThreshold: 80,
  detections: [],
  matches: [],
  anomalies: [alertAnomaly, elevatedAnomaly, normalAnomaly],
  source: "Curated FIRMS static snapshot"
};

describe("FirmsAlertFeed", () => {
  it("renders loading state when snapshot is absent and isLoading is true", () => {
    render(<FirmsAlertFeed snapshot={null} isLoading={true} error={null} />);
    expect(screen.getByText(/LOADING FIRMS/)).toBeInTheDocument();
  });

  it("renders error state when a load error was passed", () => {
    render(
      <FirmsAlertFeed
        snapshot={null}
        isLoading={false}
        error={new Error("fetch 401")}
      />
    );
    expect(screen.getByText(/FIRMS LOAD FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/fetch 401/)).toBeInTheDocument();
  });

  it("surfaces ELEVATED + ALERT entries and drops NORMAL", () => {
    render(<FirmsAlertFeed snapshot={snapshot} isLoading={false} error={null} />);

    // Ras Tanura (ALERT) + Abadan (ELEVATED) appear.
    expect(screen.getByText("RAS TANURA REFINERY")).toBeInTheDocument();
    expect(screen.getByText("ABADAN REFINERY")).toBeInTheDocument();
    // Yanbu (NORMAL) must NOT appear — it lives on the map only.
    expect(screen.queryByText("YANBU REFINERY")).not.toBeInTheDocument();
  });

  it("renders the spec-format line with count, window, and multiplier", () => {
    render(<FirmsAlertFeed snapshot={snapshot} isLoading={false} error={null} />);

    expect(
      screen.getByText(/12 detections in 72H, 4.3× above 30d average/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/5 detections in 72H, 2.5× above 30d average/)
    ).toBeInTheDocument();
  });

  it("renders the owner + capacity meta line", () => {
    render(<FirmsAlertFeed snapshot={snapshot} isLoading={false} error={null} />);

    // Two rows will each show SAUDI ARAMCO (Ras Tanura + any elevated Saudi).
    expect(
      screen.getAllByText(/SAUDI ARAMCO · 550K bpd/).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/NIOC · 400K bpd/)).toBeInTheDocument();
  });

  it("applies severity data attribute for tone-based CSS", () => {
    const { container } = render(
      <FirmsAlertFeed snapshot={snapshot} isLoading={false} error={null} />
    );
    const entries = container.querySelectorAll('[data-tone="ALERT"], [data-tone="ELEVATED"]');
    const toneValues = Array.from(entries).map((el) => el.getAttribute("data-tone"));
    expect(toneValues).toContain("ALERT");
    expect(toneValues).toContain("ELEVATED");
  });

  it("sorts ALERT before ELEVATED in DOM order", () => {
    const { container } = render(
      <FirmsAlertFeed snapshot={snapshot} isLoading={false} error={null} />
    );
    const entries = Array.from(
      container.querySelectorAll('[data-tone="ALERT"], [data-tone="ELEVATED"]')
    );
    expect(entries[0].getAttribute("data-tone")).toBe("ALERT");
    expect(entries[1].getAttribute("data-tone")).toBe("ELEVATED");
  });

  it("shows an empty-state message when the snapshot has no flagged facilities", () => {
    const emptyFlaggedSnapshot: FirmsSnapshot = {
      ...snapshot,
      anomalies: [normalAnomaly]
    };

    render(
      <FirmsAlertFeed snapshot={emptyFlaggedSnapshot} isLoading={false} error={null} />
    );

    expect(screen.getByText(/NO ELEVATED OR ALERT/)).toBeInTheDocument();
  });

  it("renders the STATIC_SNAPSHOT mode badge with its data attribute", () => {
    const { container } = render(
      <FirmsAlertFeed snapshot={snapshot} isLoading={false} error={null} />
    );
    const badge = container.querySelector('[data-mode="STATIC_SNAPSHOT"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe("STATIC");
  });

  it("keeps the jeddah reference available to prevent dead-code lint", () => {
    // Guard against the lint complaint that jeddah is unused when we
    // expand fixture coverage later. Not a behaviour test.
    expect(jeddah.id).toBe("refinery-sa-jeddah-refinery");
  });
});
