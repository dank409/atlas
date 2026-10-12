import { describe, expect, it } from "vitest";
import {
  buildCountryIndex,
  buildOperatorIndex,
  findGradeCountry,
  findMentionedAssets,
  normalizeOperatorName
} from "./referenceIndex";
import { makeField, makePipeline, makeRefinery, makeTerminal } from "../test/fixtures";
import type { CrudeGrade } from "../types/CrudeGrade";
import type { CompanyProfile, CountryProfile, OperatorAliasGroup } from "../types/Infrastructure";

const ARAMCO_ALIASES: OperatorAliasGroup = {
  canonicalSlug: "saudi-aramco",
  curatedCompanyId: "saudi-aramco",
  displayName: "Saudi Aramco",
  variants: ["Saudi Aramco", "Saudi Arabian Oil", "Aramco"]
};
const ARAMCO_PROFILE: CompanyProfile = {
  domicile: "Saudi Arabia",
  id: "saudi-aramco",
  name: "Saudi Aramco",
  source: "test",
  summary: "State oil company.",
  updated: "2026-10-10",
  website: "www.aramco.com"
};
const SAUDI_PROFILE: CountryProfile = {
  code: "SA",
  exportRoutes: "Via Ras Tanura.",
  name: "Saudi Arabia",
  source: "test",
  summary: "Largest OPEC producer.",
  updated: "2026-10-10"
};

describe("normalizeOperatorName", () => {
  it("ignores case, punctuation, bracketed asides and corporate suffixes", () => {
    const key = normalizeOperatorName("Apache");

    expect(normalizeOperatorName("Apache Corp")).toBe(key);
    expect(normalizeOperatorName("APACHE CORPORATION")).toBe(key);
    expect(normalizeOperatorName("Apache Corp. (US)")).toBe(key);
  });

  it("treats & and 'and' as the same word", () => {
    expect(normalizeOperatorName("Oman Oil Exploration & Production")).toBe(
      normalizeOperatorName("Oman Oil Exploration and Production")
    );
  });

  it("keeps differently named companies apart, including subsidiaries", () => {
    expect(normalizeOperatorName("ADNOC Offshore")).not.toBe(normalizeOperatorName("ADNOC"));
    expect(normalizeOperatorName("Kuwait Oil Company")).not.toBe(normalizeOperatorName("Kuwait National Petroleum Co"));
  });

  it("does not strip a name down to nothing", () => {
    expect(normalizeOperatorName("Company")).toBe("company");
  });
});

describe("buildOperatorIndex", () => {
  const assets = [
    makePipeline({ id: "p1", length_km: 1200, owner: "Saudi Aramco" }),
    makePipeline({ id: "p2", length_km: 300, owner: "Saudi Arabian Oil" }),
    makeField({ id: "f1", operator: "Aramco" }),
    makeRefinery({ capacity_bpd: 400000, country: "SA", id: "r1", operator: "SAUDI ARAMCO" }),
    makeRefinery({ capacity_bpd: 837000, id: "r2", operator: "ADNOC Refining" }),
    makeRefinery({ capacity_bpd: 100000, id: "r3", operator: "ADNOC REFINING" }),
    makeField({ id: "f2", operator: "unknown" }),
    makeField({ id: "f3", operator: null }),
    makeTerminal({ id: "t1", operator: null, owner: "QatarEnergy" })
  ];
  const { operatorIdByAssetId, operators } = buildOperatorIndex(assets, [ARAMCO_ALIASES], [ARAMCO_PROFILE]);

  it("merges spelling and brand variants into one operator", () => {
    const aramco = operators.find((operator) => operator.id === "saudi-aramco");

    expect(aramco?.name).toBe("Saudi Aramco");
    expect(aramco?.assets.map((asset) => asset.id)).toEqual(["p1", "p2", "f1", "r1"]);
  });

  it("adds up refining capacity and pipeline length from the assets", () => {
    const aramco = operators.find((operator) => operator.id === "saudi-aramco");

    expect(aramco?.refiningCapacityBpd).toBe(400000);
    expect(aramco?.pipelineLengthKm).toBe(1500);
  });

  it("attaches the hand-written profile the alias group points at", () => {
    expect(operators.find((operator) => operator.id === "saudi-aramco")?.profile).toBe(ARAMCO_PROFILE);
    expect(operators.find((operator) => operator.id === "adnoc-refining")?.profile).toBeNull();
  });

  it("names an unaliased operator by its commonest spelling, preferring mixed case on a tie", () => {
    expect(operators.find((operator) => operator.id === "adnoc-refining")?.name).toBe("ADNOC Refining");
  });

  it("falls back to the owner where the source gives no operator", () => {
    expect(operatorIdByAssetId.t1).toBe("qatarenergy");
  });

  it("leaves out assets whose operator is missing or a placeholder", () => {
    expect(operatorIdByAssetId.f2).toBeUndefined();
    expect(operatorIdByAssetId.f3).toBeUndefined();
    expect(operators.some((operator) => operator.name.toLowerCase() === "unknown")).toBe(false);
  });

  it("orders operators by asset count and their countries by where they have most", () => {
    expect(operators.map((operator) => operator.id)).toEqual(["saudi-aramco", "adnoc-refining", "qatarenergy"]);
    expect(operators[0].countryCodes).toEqual(["SA"]);
  });
});

describe("buildCountryIndex", () => {
  const assets = [
    makeRefinery({ capacity_bpd: 400000, country: "SA", countryName: "Saudi Arabia", id: "r1" }),
    makeRefinery({ capacity_bpd: undefined, country: "SA", countryName: "Saudi Arabia", id: "r2" }),
    makeField({ id: "f1" }),
    makeRefinery({ capacity_bpd: 100000, country: "EG", countryName: "Egypt", id: "r3" })
  ];
  const countries = buildCountryIndex(assets, [SAUDI_PROFILE], { f1: "saudi-aramco", r1: "saudi-aramco", r3: "midor" });

  it("has one entry per country on the map, in name order", () => {
    expect(countries.map((country) => country.name)).toEqual(["Egypt", "Saudi Arabia"]);
  });

  it("groups each country's assets and sums the refining capacity that is reported", () => {
    const saudi = countries.find((country) => country.code === "SA");

    expect(saudi?.assets.map((asset) => asset.id)).toEqual(["r1", "r2", "f1"]);
    expect(saudi?.refiningCapacityBpd).toBe(400000);
  });

  it("lists a cross-border pipeline under every country it runs through", () => {
    const kirkukCeyhan = makePipeline({ countries: ["IQ", "TR"], country: "IQ", countryName: "Iraq", id: "p1" });
    const izmit = makeRefinery({ country: "TR", countryName: "Turkey", id: "r-tr" });
    const index = buildCountryIndex([kirkukCeyhan, izmit], [], {});

    expect(index.find((country) => country.code === "IQ")?.assets).toEqual([kirkukCeyhan]);
    expect(index.find((country) => country.code === "TR")?.assets).toEqual([kirkukCeyhan, izmit]);
  });

  it("attaches a background note where one exists and null where it does not", () => {
    expect(countries.find((country) => country.code === "SA")?.profile).toBe(SAUDI_PROFILE);
    expect(countries.find((country) => country.code === "EG")?.profile).toBeNull();
  });

  it("lists each country's operators, most assets first", () => {
    expect(countries.find((country) => country.code === "SA")?.operatorIds).toEqual(["saudi-aramco"]);
    expect(countries.find((country) => country.code === "EG")?.operatorIds).toEqual(["midor"]);
  });

  it("includes a country that has a note but no assets", () => {
    const withNoteOnly = buildCountryIndex([], [SAUDI_PROFILE], {});

    expect(withNoteOnly).toHaveLength(1);
    expect(withNoteOnly[0].assets).toEqual([]);
  });
});

describe("findGradeCountry", () => {
  const grade = { producer: "Saudi Arabia" } as CrudeGrade;

  it("matches a grade's producer to a country by name", () => {
    expect(findGradeCountry(grade, [{ name: "Iran" }, { name: "saudi arabia" }])).toEqual({ name: "saudi arabia" });
    expect(findGradeCountry(grade, [{ name: "Iran" }])).toBeNull();
  });
});

describe("findMentionedAssets", () => {
  const safaniya = makeField({ id: "safaniya", name: "Safaniya Oil and Gas Field (Saudi Arabia)" });
  const kirkukCeyhan = makePipeline({ id: "kc", name: "Kirkuk-Ceyhan Oil Pipeline" });
  const yemenLng = makeTerminal({ id: "ylng", name: "Yemen LNG Terminal" });
  const bab = makeField({ id: "bab", name: "Bab Oil Field (United Arab Emirates)" });
  const north = makeField({ id: "north", name: "North Field" });
  const candidates = [safaniya, kirkukCeyhan, yemenLng, bab, north];

  it("links an asset when its place name appears in the text", () => {
    expect(findMentionedAssets("From Safaniya, the largest offshore field.", candidates)).toEqual([safaniya]);
  });

  it("matches across typographic dashes and letter case", () => {
    expect(findMentionedAssets("Exported via the KIRKUK–CEYHAN line.", candidates)).toEqual([kirkukCeyhan]);
  });

  it("only matches whole words", () => {
    expect(findMentionedAssets("A northern grade.", candidates)).toEqual([]);
    expect(findMentionedAssets("From the North Field.", candidates)).toEqual([north]);
  });

  it("skips place names too short to be distinctive", () => {
    expect(findMentionedAssets("Murban comes from Bab and Bu Hasa.", candidates)).toEqual([]);
  });

  it("skips names it is told to ignore, such as country names", () => {
    expect(findMentionedAssets("An onshore Yemen grade.", candidates)).toEqual([yemenLng]);
    expect(findMentionedAssets("An onshore Yemen grade.", candidates, ["Yemen"])).toEqual([]);
  });
});
