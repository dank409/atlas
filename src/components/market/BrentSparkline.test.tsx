import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrentSparkline } from "./BrentSparkline";

describe("BrentSparkline", () => {
  it("renders a fallback message when the series is too short", () => {
    render(<BrentSparkline series={[{ date: "2026-04-14", value: 77.35 }]} />);
    expect(screen.getByText("INSUFFICIENT DATA")).toBeInTheDocument();
  });

  it("renders an SVG with min/max axis labels derived from the series", () => {
    render(
      <BrentSparkline
        series={[
          { date: "2026-04-10", value: 75 },
          { date: "2026-04-11", value: 76.5 },
          { date: "2026-04-14", value: 78.25 }
        ]}
      />
    );
    const chart = screen.getByRole("img", { name: "BRENT 30D SPARKLINE" });
    expect(chart.tagName.toLowerCase()).toBe("svg");
    expect(screen.getByText("$78.25")).toBeInTheDocument();
    expect(screen.getByText("$75.00")).toBeInTheDocument();
  });
});
