import { describe, expect, it } from "vitest";
import { ENERGY_COLORS, ENERGY_LABELS, ENERGY_TYPES, getEnergyType } from "./assetEnergy";
import { makeField, makePipeline, makeRefinery, makeTerminal } from "../test/fixtures";

describe("getEnergyType", () => {
  it("treats every refinery as crude oil and every LNG terminal as gas", () => {
    expect(getEnergyType(makeRefinery())).toBe("oil");
    expect(getEnergyType(makeTerminal())).toBe("gas");
  });

  it("follows a pipeline's hydrocarbon", () => {
    expect(getEnergyType(makePipeline({ hydrocarbon: "crude_oil" }))).toBe("oil");
    expect(getEnergyType(makePipeline({ hydrocarbon: "natural_gas" }))).toBe("gas");
    expect(getEnergyType(makePipeline({ hydrocarbon: "ngl" }))).toBe("ngl");
  });

  it("follows a field's type and treats unclassified fields as mixed", () => {
    expect(getEnergyType(makeField({ fieldType: "oil" }))).toBe("oil");
    expect(getEnergyType(makeField({ fieldType: "gas" }))).toBe("gas");
    expect(getEnergyType(makeField({ fieldType: "mixed" }))).toBe("mixed");
    expect(getEnergyType(makeField({ fieldType: undefined }))).toBe("mixed");
  });
});

describe("energy palette", () => {
  it("has a label and a distinct colour for every energy type", () => {
    const colors = ENERGY_TYPES.map((type) => ENERGY_COLORS[type]);

    expect(new Set(colors).size).toBe(ENERGY_TYPES.length);
    expect(ENERGY_TYPES.every((type) => ENERGY_LABELS[type].length > 0)).toBe(true);
  });
});
