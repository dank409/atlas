import { describe, expect, it } from "vitest";
import { MARKER_ICON_SIZE, buildMarkerIcon, type MarkerIcon } from "./markerIcons";

function pixel(icon: MarkerIcon, x: number, y: number) {
  const offset = (y * icon.width + x) * 4;

  return Array.from(icon.data.slice(offset, offset + 4));
}

const CENTER = MARKER_ICON_SIZE / 2;

describe("buildMarkerIcon", () => {
  it("returns a square RGBA bitmap", () => {
    const icon = buildMarkerIcon("diamond", "#FF8C00");

    expect(icon.width).toBe(MARKER_ICON_SIZE);
    expect(icon.height).toBe(MARKER_ICON_SIZE);
    expect(icon.data).toHaveLength(MARKER_ICON_SIZE * MARKER_ICON_SIZE * 4);
  });

  it("fills the centre with the requested colour, fully opaque", () => {
    expect(pixel(buildMarkerIcon("diamond", "#FF8C00"), CENTER, CENTER)).toEqual([255, 140, 0, 255]);
    expect(pixel(buildMarkerIcon("triangle", "#42A5F5"), CENTER, CENTER + 4)).toEqual([66, 165, 245, 255]);
  });

  it("leaves the corners transparent", () => {
    for (const shape of ["diamond", "triangle"] as const) {
      const icon = buildMarkerIcon(shape, "#FF8C00");

      expect(pixel(icon, 0, 0)[3]).toBe(0);
      expect(pixel(icon, MARKER_ICON_SIZE - 1, 0)[3]).toBe(0);
    }
  });

  it("draws a dark outline between the fill and the edge", () => {
    // Just inside the diamond's left point: opaque, but outline-coloured.
    const [red, green, blue, alpha] = pixel(buildMarkerIcon("diamond", "#FF8C00"), 3, CENTER);

    expect(alpha).toBeGreaterThan(200);
    expect(red + green + blue).toBeLessThan(60);
  });

  it("points the triangle up: wide at the bottom, empty beside the apex", () => {
    const icon = buildMarkerIcon("triangle", "#42A5F5");

    expect(pixel(icon, 6, MARKER_ICON_SIZE - 10)[3]).toBeGreaterThan(0);
    expect(pixel(icon, 6, 8)[3]).toBe(0);
  });
});
