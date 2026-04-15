type MapStyleMutator = {
  getLayer: (layerId: string) => { id: string } | undefined;
  setLayoutProperty: (layerId: string, property: string, value: unknown) => void;
  setPaintProperty: (layerId: string, property: string, value: unknown) => void;
};

export const TERMINAL_DARK_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function applyTerminalDarkBasemapTheme(_map: MapStyleMutator) {
  return;
}
