import { describe, expect, it } from "vitest";
import {
  buildSearchResults,
  countByDataset,
  countByEnergyType,
  filterAssets,
  formatPrimaryMetric,
  getAssetDisplayName,
  getAssetOperator,
  getAssetTypeLabel,
  getPrimaryMetricValue,
  getSourceStatus,
  isOperating,
  matchesQuery,
  sortByPrimaryMetric
} from "./infrastructure";
import { ENERGY_TYPES } from "./assetEnergy";
import { makeField, makePipeline, makeRefinery, makeTerminal } from "../test/fixtures";
import type { DatasetId } from "../types/Infrastructure";

const ruwais = makeRefinery();
const eastWest = makePipeline();
const gasLine = makePipeline({ hydrocarbon: "natural_gas", id: "pipeline-gas", name: "Dolphin Gas Pipeline" });
const ghawar = makeField();
const mixedField = makeField({ fieldType: "mixed", id: "field-mixed", name: "Zubair Field" });
const rasLaffan = makeTerminal();
const ASSETS = [ruwais, eastWest, gasLine, ghawar, mixedField, rasLaffan];
const ALL_LAYERS: DatasetId[] = ["refineries", "pipelines", "fields", "terminals"];

describe("filterAssets", () => {
  it("keeps only assets whose layer is switched on", () => {
    expect(filterAssets(ASSETS, ["refineries"], [...ENERGY_TYPES])).toEqual([ruwais]);
    expect(filterAssets(ASSETS, [], [...ENERGY_TYPES])).toEqual([]);
  });

  it("keeps only assets whose energy type is switched on, across layers", () => {
    expect(filterAssets(ASSETS, ALL_LAYERS, ["gas"])).toEqual([gasLine, rasLaffan]);
    expect(filterAssets(ASSETS, ALL_LAYERS, ["oil"])).toEqual([ruwais, eastWest, ghawar]);
    expect(filterAssets(ASSETS, ALL_LAYERS, ["mixed"])).toEqual([mixedField]);
    expect(filterAssets(ASSETS, ALL_LAYERS, [])).toEqual([]);
  });

  it("applies both toggles together", () => {
    expect(filterAssets(ASSETS, ["pipelines"], ["gas"])).toEqual([gasLine]);
  });
});

describe("countByDataset", () => {
  it("counts assets per layer, including zeroes", () => {
    expect(countByDataset(ASSETS)).toEqual({ fields: 2, pipelines: 2, refineries: 1, terminals: 1 });
    expect(countByDataset([])).toEqual({ fields: 0, pipelines: 0, refineries: 0, terminals: 0 });
  });
});

describe("sortByPrimaryMetric", () => {
  it("puts the largest first and assets with no figure last, by name", () => {
    const small = makeRefinery({ capacity_bpd: 100000, id: "small", name: "Small" });
    const unreportedB = makeRefinery({ capacity_bpd: undefined, id: "b", name: "Beta" });
    const unreportedA = makeRefinery({ capacity_bpd: undefined, id: "a", name: "Alpha" });

    expect(sortByPrimaryMetric([unreportedB, small, ruwais, unreportedA]).map((asset) => asset.id)).toEqual([
      "refinery-ruwais",
      "small",
      "a",
      "b"
    ]);
  });
});

describe("countByEnergyType", () => {
  it("counts assets per energy type, including zeroes", () => {
    expect(countByEnergyType(ASSETS)).toEqual({ gas: 2, mixed: 1, ngl: 0, oil: 3 });
  });
});

describe("search", () => {
  it("returns nothing for a blank search but matches everything for a blank row filter", () => {
    expect(buildSearchResults(ASSETS, "   ")).toEqual([]);
    expect(matchesQuery(ruwais, "")).toBe(true);
  });

  it("matches name, country, operator and type, ignoring case and outer spaces", () => {
    expect(buildSearchResults(ASSETS, "  GHAWAR ")).toEqual([ghawar]);
    expect(buildSearchResults(ASSETS, "qatar")).toEqual([rasLaffan]);
    expect(buildSearchResults(ASSETS, "natural gas")).toEqual([gasLine]);
    expect(buildSearchResults(ASSETS, "adnoc")).toEqual([ruwais]);
    expect(buildSearchResults(ASSETS, "lng terminal")).toEqual([rasLaffan]);
  });
});

describe("getAssetDisplayName", () => {
  it("appends the segment to pipelines that share a name, and is searchable by it", () => {
    const segment = makePipeline({ id: "pipeline-segment", name: "Abqaiq-Qatif Oil Pipelines", segmentName: "Pipeline 3" });

    expect(getAssetDisplayName(segment)).toBe("Abqaiq-Qatif Oil Pipelines · Pipeline 3");
    expect(buildSearchResults([segment], "pipeline 3")).toEqual([segment]);
  });

  it("uses the plain name for everything else", () => {
    expect(getAssetDisplayName(eastWest)).toBe("East-West Crude Oil Pipeline");
    expect(getAssetDisplayName(ruwais)).toBe("Ruwais Refinery");
  });
});

describe("getAssetOperator", () => {
  it("uses the operator where the source gives one and the owner otherwise", () => {
    expect(getAssetOperator(ruwais)).toBe("ADNOC Refining");
    expect(getAssetOperator(eastWest)).toBe("Saudi Aramco");
    expect(getAssetOperator(makeTerminal({ operator: null }))).toBe("QatarEnergy");
    expect(getAssetOperator(makeField({ operator: null }))).toBeNull();
  });
});

describe("source status", () => {
  it("is absent for refineries, whose source publishes none", () => {
    expect(getSourceStatus(ruwais)).toBeNull();
    expect(isOperating(ruwais)).toBe(true);
  });

  it("passes through what GEM publishes for the other layers", () => {
    const proposed = makePipeline({ status: "proposed" });

    expect(getSourceStatus(eastWest)).toBe("operating");
    expect(isOperating(eastWest)).toBe(true);
    expect(getSourceStatus(proposed)).toBe("proposed");
    expect(isOperating(proposed)).toBe(false);
    expect(isOperating(makeTerminal({ status: "mothballed" }))).toBe(false);
  });
});

describe("primary metric", () => {
  it("formats each asset kind in its own unit", () => {
    expect(formatPrimaryMetric(ruwais)).toBe("837,000 BPD");
    expect(formatPrimaryMetric(eastWest)).toBe("5,000,000 BOE/D");
    // Field figures combine oil and gas, so they are barrels of oil equivalent.
    expect(formatPrimaryMetric(ghawar)).toBe("1,700,000 BOE/D");
    expect(formatPrimaryMetric(rasLaffan)).toBe("64.0 MTPA");
  });

  it("shows -- and sorts as 0 when the source reports no value", () => {
    const unreported = makeField({ production_bpd: undefined });

    expect(formatPrimaryMetric(unreported)).toBe("--");
    expect(getPrimaryMetricValue(unreported)).toBe(0);
    expect(formatPrimaryMetric(makeRefinery({ capacity_bpd: 0 }))).toBe("--");
  });

  it("exposes the raw number for sorting", () => {
    expect(getPrimaryMetricValue(ruwais)).toBe(837000);
    expect(getPrimaryMetricValue(rasLaffan)).toBe(64);
  });
});

describe("getAssetTypeLabel", () => {
  it("names each asset kind", () => {
    expect([ruwais, eastWest, ghawar, rasLaffan].map(getAssetTypeLabel)).toEqual([
      "REFINERY",
      "PIPELINE",
      "FIELD",
      "LNG TERMINAL"
    ]);
  });
});
