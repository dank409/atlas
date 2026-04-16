export type SizeByOption = "capacity" | "production" | "reserves" | "uniform";
export type ColorByOption = "status" | "hydrocarbon";

export interface MapDisplaySettings {
  pointSize: number;
  sizeBy: SizeByOption;
  colorBy: ColorByOption;
  showLabels: boolean;
}

export const DEFAULT_MAP_DISPLAY_SETTINGS: MapDisplaySettings = {
  pointSize: 3,
  sizeBy: "capacity",
  colorBy: "status",
  showLabels: false
};
