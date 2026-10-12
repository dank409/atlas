import { describe, expect, it } from "vitest";
import { NO_FILTERS, applyAssetFilters, hasActiveFilters, isInCountry } from "./assetFilters";
import { makeField, makePipeline, makeRefinery } from "../test/fixtures";

const ruwais = makeRefinery();
const ghawar = makeField();
const smallField = makeField({ id: "f-small", name: "Small Field", production_bpd: 5000 });
const unreportedField = makeField({ id: "f-unreported", name: "Unreported Field", production_bpd: undefined });
const iraqiField = makeField({ country: "IQ", countryName: "Iraq", id: "f-iq", production_bpd: 900000 });
const kirkukCeyhan = makePipeline({ countries: ["IQ", "TR"], country: "IQ", countryName: "Iraq", id: "p-kc" });
const ASSETS = [ruwais, ghawar, smallField, unreportedField, iraqiField, kirkukCeyhan];
const OPERATORS = { "f-iq": "basra-oil", "f-small": "saudi-aramco", "field-ghawar": "saudi-aramco", "p-kc": "basra-oil" };

function ids(filters: Partial<typeof NO_FILTERS>) {
  return applyAssetFilters(ASSETS, { ...NO_FILTERS, ...filters }, OPERATORS).map((asset) => asset.id);
}

describe("isInCountry", () => {
  it("matches an asset's own country, and everything when no country is chosen", () => {
    expect(isInCountry(ruwais, "AE")).toBe(true);
    expect(isInCountry(ruwais, "SA")).toBe(false);
    expect(isInCountry(ruwais, null)).toBe(true);
  });

  it("matches a pipeline in every country it runs through", () => {
    expect(isInCountry(kirkukCeyhan, "IQ")).toBe(true);
    expect(isInCountry(kirkukCeyhan, "TR")).toBe(true);
    expect(isInCountry(kirkukCeyhan, "SY")).toBe(false);
  });
});

describe("applyAssetFilters", () => {
  it("returns everything, untouched, when no filter is set", () => {
    expect(applyAssetFilters(ASSETS, NO_FILTERS, OPERATORS)).toBe(ASSETS);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it("filters by country", () => {
    expect(ids({ countryCode: "TR" })).toEqual(["p-kc"]);
    expect(hasActiveFilters({ ...NO_FILTERS, countryCode: "TR" })).toBe(true);
  });

  it("filters by operator, using the operator index's grouping", () => {
    expect(ids({ operatorId: "saudi-aramco" })).toEqual(["field-ghawar", "f-small"]);
  });

  it("keeps the largest of each layer, leaving out assets with no figure to rank by", () => {
    // One refinery, one pipeline, and the biggest field.
    expect(ids({ largestPerLayer: 1 })).toEqual(["refinery-ruwais", "field-ghawar", "p-kc"]);
    expect(ids({ largestPerLayer: 10 })).not.toContain("f-unreported");
  });

  it("ranks within what the country and operator filters leave", () => {
    expect(ids({ countryCode: "IQ", largestPerLayer: 1 })).toEqual(["f-iq", "p-kc"]);
    expect(ids({ largestPerLayer: 1, operatorId: "saudi-aramco" })).toEqual(["field-ghawar"]);
  });
});
