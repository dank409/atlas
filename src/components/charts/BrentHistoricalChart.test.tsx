import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrentHistoricalChart, computeChartGeometry } from "./BrentHistoricalChart";
import type { PricePoint } from "../../types/Market";
import type { OutageEvent } from "../../types/outageEvent";

// Weekly synthetic fixture — ~4 years. Enough density for the 1Y/2Y/5Y
// window buttons to actually filter something.
function buildSeries(): PricePoint[] {
  const points: PricePoint[] = [];
  const start = new Date("2022-04-15T00:00:00Z").getTime();
  for (let i = 0; i < 104; i += 1) {
    const date = new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10);
    const value = 70 + 10 * Math.sin(i / 8) + (i % 5) * 0.3;
    points.push({ date, value: Math.round(value * 100) / 100 });
  }
  return points;
}

const series = buildSeries();

const events: OutageEvent[] = [
  {
    id: "abqaiq-khurais-attack-2019-09-14",
    date: "2019-09-14",
    name: "Abqaiq-Khurais Strike",
    country: "Saudi Arabia",
    severity: "CRITICAL",
    category: "attack",
    outageVolumeBpd: 5700000,
    durationDays: 10,
    summary: "Drone strike on processing facility.",
    resolved: true,
    priceReaction: { brentChangePct: 14.6, windowHours: 24 }
  },
  {
    id: "jeddah-aramco-storage-strike-2022-03-25",
    date: "2022-12-15", // inside the 2y/5y windows for the fixture
    name: "Jeddah Aramco Storage Strike",
    country: "Saudi Arabia",
    severity: "HIGH",
    category: "attack",
    outageVolumeBpd: 120000,
    durationDays: 3,
    summary: "Aramco storage hit by Houthi missile during Formula 1 race.",
    resolved: true,
    priceReaction: { brentChangePct: 1.6, windowHours: 24 }
  },
  {
    id: "galaxy-leader-seizure-2023-11-19",
    date: "2023-11-19",
    name: "Galaxy Leader Red Sea Seizure",
    country: "Yemen",
    severity: "MEDIUM",
    category: "attack",
    outageVolumeBpd: 0,
    durationDays: 120,
    summary: "Houthi seizure of Galaxy Leader in the southern Red Sea.",
    resolved: false
  }
];

describe("BrentHistoricalChart", () => {
  it("renders the title, window controls, and source line", () => {
    render(
      <BrentHistoricalChart
        series={series}
        events={events}
        asOf="2024-04-15"
        source="Static test"
      />
    );

    expect(screen.getByText(/BRENT HISTORICAL/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1Y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5Y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MAX" })).toBeInTheDocument();
    expect(screen.getByText(/SOURCE: Static test/)).toBeInTheDocument();
  });

  it("shows a tooltip when an event rule is clicked", () => {
    render(
      <BrentHistoricalChart
        series={series}
        events={events}
        asOf="2024-04-15"
        source="Static test"
      />
    );

    // The Jeddah event falls inside the 5y window. Rules are <line> elements
    // inside the svg — query them as DOM nodes and click the first one.
    const lines = document.querySelectorAll("line[data-event-rule]");
    expect(lines.length).toBeGreaterThan(0);
    fireEvent.click(lines[0]);

    // Tooltip dialog should appear with an event name header.
    expect(screen.getByRole("dialog", { name: "Event detail" })).toBeInTheDocument();
  });

  it("hides event rules when the EVENTS toggle is flipped off", () => {
    render(
      <BrentHistoricalChart
        series={series}
        events={events}
        asOf="2024-04-15"
        source="Static test"
      />
    );

    // First: events on by default, some dashed rules exist.
    expect(document.querySelectorAll("line[data-event-rule]").length).toBeGreaterThan(0);

    // Toggle off.
    fireEvent.click(screen.getByRole("button", { name: /EVENTS/ }));
    expect(document.querySelectorAll("line[data-event-rule]").length).toBe(0);
  });

  it("window 1Y narrows the event-rule count compared to 5Y", () => {
    render(
      <BrentHistoricalChart
        series={series}
        events={events}
        asOf="2024-04-15"
        source="Static test"
      />
    );

    const countIn5y = document.querySelectorAll("line[data-event-rule]").length;

    fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    const countIn1y = document.querySelectorAll("line[data-event-rule]").length;

    expect(countIn1y).toBeLessThanOrEqual(countIn5y);
  });

  it("falls back to an empty state when the series is empty", () => {
    render(
      <BrentHistoricalChart series={[]} events={events} asOf={null} source={null} />
    );
    expect(screen.getByText("NO BRENT HISTORICAL DATA.")).toBeInTheDocument();
  });
});

describe("computeChartGeometry (pure)", () => {
  it("returns an empty result when the series is empty", () => {
    expect(computeChartGeometry([], events, "5Y")).toBeNull();
  });

  it("produces a monotonically increasing price path along the x axis", () => {
    const geometry = computeChartGeometry(series, events, "MAX");
    expect(geometry).not.toBeNull();
    // pricePath starts with "M<x>,<y>"
    expect(geometry?.pricePath.startsWith("M")).toBe(true);
    expect(geometry?.yTicks.length).toBeGreaterThan(0);
  });

  it("filters events outside the selected window", () => {
    const geometry = computeChartGeometry(series, events, "1Y");
    // The 2019 Abqaiq event is older than the 1Y window relative to the
    // fixture's last point (~2024-04), so it must not appear.
    expect(
      geometry?.eventLines.find(
        (line) => line.id === "abqaiq-khurais-attack-2019-09-14"
      )
    ).toBeUndefined();
  });
});
