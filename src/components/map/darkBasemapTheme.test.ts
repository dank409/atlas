import { describe, expect, it, vi } from "vitest";
import { TERMINAL_DARK_STYLE_URL, applyTerminalDarkBasemapTheme } from "./darkBasemapTheme";

describe("darkBasemapTheme", () => {
  it("uses the Carto Dark Matter style as the terminal dark basemap foundation", () => {
    expect(TERMINAL_DARK_STYLE_URL).toBe("https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json");
    expect(TERMINAL_DARK_STYLE_URL.startsWith("https://")).toBe(true);
  });

  it("does not try to repaint the basemap after load", () => {
    const map = {
      getLayer: vi.fn(),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn()
    };

    applyTerminalDarkBasemapTheme(map);

    expect(map.getLayer).not.toHaveBeenCalled();
    expect(map.setLayoutProperty).not.toHaveBeenCalled();
    expect(map.setPaintProperty).not.toHaveBeenCalled();
  });

  it("keeps the old Mapbox dark style out of the contract", () => {
    expect(TERMINAL_DARK_STYLE_URL).not.toBe("mapbox://styles/mapbox/dark-v11");
  });
});
