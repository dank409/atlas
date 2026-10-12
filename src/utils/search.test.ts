import { describe, expect, it } from "vitest";
import { buildWorkspaceSearchResults, MAX_SEARCH_RESULTS } from "./search";
import { buildCountryIndex, buildOperatorIndex } from "./referenceIndex";
import { makeField, makePipeline, makeRefinery } from "../test/fixtures";
import type { CrudeGrade } from "../types/CrudeGrade";

const ruwais = makeRefinery();
const eastWest = makePipeline();
const ghawar = makeField();
const kirkukField = makeField({
  country: "IQ",
  countryName: "Iraq",
  id: "field-kirkuk",
  name: "Kirkuk Oil Field",
  operator: "North Oil Company"
});
const ASSETS = [ruwais, eastWest, ghawar, kirkukField];

const { operatorIdByAssetId, operators } = buildOperatorIndex(ASSETS, [], []);
const countries = buildCountryIndex(ASSETS, [], operatorIdByAssetId);

function grade(id: string, name: string, producer: string): CrudeGrade {
  return { apiGravity: 33, id, name, note: "", producer, producerIso: "XXX", source: "test", sulfurPct: 2 };
}

const GRADES = [grade("kirkuk", "Kirkuk", "Iraq"), grade("murban", "Murban", "United Arab Emirates")];
const SOURCES = { assets: ASSETS, countries, grades: GRADES, operators };

function search(query: string, sources = SOURCES) {
  return buildWorkspaceSearchResults(query, sources);
}

describe("buildWorkspaceSearchResults", () => {
  it("returns nothing for a blank query", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  it("finds a country by name and says how many assets it has", () => {
    expect(search("iraq")[0]).toEqual({
      key: "country:IQ",
      meta: "COUNTRY | 1 ASSET",
      name: "Iraq",
      target: { id: "IQ", kind: "reference", tab: "countries" }
    });
  });

  it("finds an operator by name", () => {
    expect(search("aramco")[0]).toEqual({
      key: "operator:saudi-aramco",
      meta: "OPERATOR | 2 ASSETS",
      name: "Saudi Aramco",
      target: { id: "saudi-aramco", kind: "reference", tab: "operators" }
    });
  });

  it("finds a crude grade by name and names its producer", () => {
    expect(search("murb")).toEqual([
      {
        key: "grade:murban",
        meta: "CRUDE GRADE | UNITED ARAB EMIRATES",
        name: "Murban",
        target: { id: "murban", kind: "reference", tab: "grades" }
      }
    ]);
  });

  it("still finds assets, by name, country or operator, described by type and country", () => {
    expect(search("ruwais")).toEqual([
      {
        key: "asset:refinery-ruwais",
        meta: "REFINERY | UNITED ARAB EMIRATES",
        name: "Ruwais Refinery",
        target: { asset: ruwais, kind: "asset" }
      }
    ]);
    expect(search("adnoc refining").map((result) => result.key)).toEqual([
      "operator:adnoc-refining",
      "asset:refinery-ruwais"
    ]);
  });

  it("lists reference entries before assets: countries, then grades, then operators", () => {
    // "kirkuk" is a grade and a field; "saudi" is a country, an operator and three assets.
    expect(search("kirkuk").map((result) => result.key)).toEqual(["grade:kirkuk", "asset:field-kirkuk"]);
    expect(search("saudi").map((result) => result.key)).toEqual([
      "country:SA",
      "operator:saudi-aramco",
      "asset:pipeline-east-west",
      "asset:field-ghawar"
    ]);
  });

  it("matches reference entries on their name only, not on what they contain", () => {
    // Searching a producer lists its country, not every grade it produces.
    expect(search("united arab").map((result) => result.key)).toEqual(["country:AE", "asset:refinery-ruwais"]);
  });

  it("caps reference entries so assets are never crowded out, and caps the whole list", () => {
    const manyGrades = Array.from({ length: 10 }, (_, index) => grade(`blend-${index}`, `Saudi Blend ${index}`, "Saudi Arabia"));
    const manyFields = Array.from({ length: 10 }, (_, index) =>
      makeField({ id: `field-${index}`, name: `Saudi Field ${index}` })
    );
    const results = search("saudi", { ...SOURCES, assets: manyFields, grades: manyGrades });

    expect(results).toHaveLength(MAX_SEARCH_RESULTS);
    expect(results.filter((result) => result.target.kind === "reference")).toHaveLength(4);
    expect(results.filter((result) => result.target.kind === "asset")).toHaveLength(4);
  });
});
