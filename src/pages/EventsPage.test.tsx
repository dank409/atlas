import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventsPage } from "./EventsPage";
import type { OutageEvent } from "../types/outageEvent";

function event(id: string, country: string, date: string, severity: OutageEvent["severity"]): OutageEvent {
  return {
    id,
    date,
    name: `Event ${id}`,
    country,
    severity,
    category: "attack",
    outageVolumeBpd: 100000,
    durationDays: 1,
    summary: `Test summary for ${id}.`,
    resolved: true
  };
}

describe("EventsPage", () => {
  const events: OutageEvent[] = [
    event("e1", "SA", "2026-03-10", "HIGH"),
    event("e2", "IR", "2026-03-15", "MEDIUM"),
    event("e3", "AE", "2026-04-01", "CRITICAL")
  ];

  it("renders the feed/swimlane switcher", () => {
    render(<EventsPage firmsAnomalies={[]} outageEvents={events} />);
    expect(screen.getByText("FEED")).toBeDefined();
    expect(screen.getByText("SWIMLANE")).toBeDefined();
  });

  it("switches to the swimlane view on click", () => {
    render(<EventsPage firmsAnomalies={[]} outageEvents={events} />);
    fireEvent.click(screen.getByText("SWIMLANE"));
    expect(screen.getByText("EVENT SWIMLANE")).toBeDefined();
  });

  it("filters events by timeT when rewound", () => {
    // timeT=0 means "start of window", so events at the end of the
    // series should be hidden. With 3 events the earliest is e1 on
    // 2026-03-10 so only that one should appear.
    render(<EventsPage firmsAnomalies={[]} outageEvents={events} timeT={0} />);
    expect(screen.getByText(/Test summary for e1/)).toBeDefined();
    expect(screen.queryByText(/Test summary for e3/)).toBeNull();
  });
});
