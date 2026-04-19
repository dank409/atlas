import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("renders an empty chart when the series has fewer than two points", () => {
    const { container } = render(<Sparkline series={[42]} />);
    // Empty state is still an svg so layout stays stable in dense rows.
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders line + area paths for a valid series", () => {
    const { container } = render(<Sparkline series={[10, 12, 9, 14]} />);
    const paths = container.querySelectorAll("path");
    // One filled area path + one stroked line path.
    expect(paths.length).toBe(2);
  });

  it("respects the fill=false prop by omitting the area path", () => {
    const { container } = render(<Sparkline fill={false} series={[10, 12, 9, 14]} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
  });

  it("uses the provided aria label", () => {
    const { container } = render(
      <Sparkline ariaLabel="BRENT 30D" series={[10, 12]} />
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("BRENT 30D");
  });
});
