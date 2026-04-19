import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertsPage } from "./AlertsPage";

describe("AlertsPage", () => {
  // Storage is reset globally in `src/test/setup.ts` before each test.

  it("shows the empty-state message when no rules are defined", () => {
    render(<AlertsPage />);
    expect(screen.getByText(/NO ALERTS DEFINED/)).toBeDefined();
  });

  it("creates and arms a new alert, persisting it to localStorage", () => {
    const onAlertCreated = vi.fn();
    render(<AlertsPage onAlertCreated={onAlertCreated} />);

    fireEvent.change(screen.getByPlaceholderText(/Brent above 90/), {
      target: { value: "Brent crosses 90" }
    });
    fireEvent.click(screen.getByText("CREATE & ARM"));

    expect(onAlertCreated).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Brent crosses 90")).toBeDefined();
    const persisted = window.localStorage.getItem("atlas.alerts.v1") ?? "[]";
    expect(JSON.parse(persisted)).toHaveLength(1);
  });

  it("toggles a rule between ARMED and PAUSED", () => {
    render(<AlertsPage />);
    fireEvent.change(screen.getByPlaceholderText(/Brent above 90/), {
      target: { value: "Test rule" }
    });
    fireEvent.click(screen.getByText("CREATE & ARM"));

    expect(screen.getByText("ARMED")).toBeDefined();
    fireEvent.click(screen.getByText("PAUSE"));
    expect(screen.getByText("PAUSED")).toBeDefined();
  });

  it("disables the AWAITING FEED disclaimer line", () => {
    render(<AlertsPage />);
    expect(
      screen.getByText(/Automated evaluation against the live market feed is a follow-up/)
    ).toBeDefined();
  });
});
