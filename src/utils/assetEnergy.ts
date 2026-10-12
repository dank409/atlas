import type { InfrastructureAsset } from "../types/Infrastructure";

// What an asset produces, carries or processes. This is the colour
// dimension on the map; the marker shape says what kind of asset it is.
export type EnergyType = "oil" | "gas" | "ngl" | "mixed";

export const ENERGY_TYPES: readonly EnergyType[] = ["oil", "gas", "ngl", "mixed"];

export const ENERGY_LABELS: Record<EnergyType, string> = {
  gas: "Natural gas / LNG",
  mixed: "Oil & gas (mixed)",
  ngl: "NGL",
  oil: "Crude oil"
};

// Hues are far apart on purpose: NGL is violet rather than a second amber
// so it cannot be mistaken for crude on a dense map.
export const ENERGY_COLORS: Record<EnergyType, string> = {
  gas: "#42A5F5",
  mixed: "#BDBDBD",
  ngl: "#B388FF",
  oil: "#FF8C00"
};

/**
 * Read straight off the source fields: a pipeline's hydrocarbon, a field's
 * type. Refineries in this dataset are all crude oil refineries and the
 * terminals are all LNG, so those two are fixed.
 */
export function getEnergyType(asset: InfrastructureAsset): EnergyType {
  if (asset.assetKind === "refinery") {
    return "oil";
  }

  if (asset.assetKind === "terminal") {
    return "gas";
  }

  if (asset.assetKind === "pipeline") {
    return asset.hydrocarbon === "natural_gas" ? "gas" : asset.hydrocarbon === "ngl" ? "ngl" : "oil";
  }

  return asset.fieldType === "oil" ? "oil" : asset.fieldType === "gas" ? "gas" : "mixed";
}
