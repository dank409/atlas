import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineScrubber } from "./TimelineScrubber";
import type { OutageEvent } from "../../types/outageEvent";

function makeSeries(count: number, startIso: string) {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    value: 80 + Math.sin(i / 5) * 3
  }));
}

function outage(id: string, date: string, severity: OutageEvent["severity"]): OutageEvent {
  return {
    id,
    date,
    name: `Outage ${id}`,
    country: "SA",
    severity,
    category: "attack",
    outageVolumeBpd: 500000,
    durationDays: 3,
    summary: "Test outage",
    resolved: true
  };
}

describe("TimelineScrubber", () => {
  it("renders loading label when series is too short", () => {
    render(<TimelineScrubber brentSeries={[]} outageEvents={[]} />);
    expect(screen.getByText(/LOADING/)).toBeDefined();
  });

  it("renders window label and NOW badge with a valid series", () => {
    render(
      <TimelineScrubber
        brentSeries={makeSeries(120, "2026-01-01")}
        outageEvents={[]}
      />
    );
    expect(screen.getByText("TIMELINE · 90D")).toBeDefined();
    expect(screen.getByText("NOW")).toBeDefined();
  });

  it("renders a marker line per outage inside the window", () => {
    const series = makeSeries(120, "2026-01-01");
    // Newest date in the series is 2026-01-01 + 119d ≈ 2026-04-30.
    const events = [
      outage("o1", "2026-03-20", "HIGH"),
      outage("o2", "2026-04-02", "MEDIUM"),
      outage("o3", "2026-01-01", "HIGH") // outside the 90d window
    ];
    const { container } = render(
      <TimelineScrubber brentSeries={series} outageEvents={events} />
    );
    // Two event markers + the NOW edge-line + path elements. Count only
    // lines with the `marker` module class.
    const markers = container.querySelectorAll("[class*='marker']");
    expect(markers.length).toBe(2);
  });

  it("respects a custom windowDays prop", () => {
    render(
      <TimelineScrubber
        brentSeries={makeSeries(120, "2026-01-01")}
        outageEvents={[]}
        windowDays={30}
      />
    );
    expect(screen.getByText("TIMELINE · 30D")).toBeDefined();
  });
});
