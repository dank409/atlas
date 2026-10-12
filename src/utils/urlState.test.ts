import { describe, expect, it } from "vitest";
import { buildUrlSearch, parseUrlState, type UrlState } from "./urlState";

describe("buildUrlSearch", () => {
  it("is empty for the opening map, so the plain address stays plain", () => {
    expect(buildUrlSearch({ view: "map" })).toBe("");
  });

  it("records the selected asset on the map", () => {
    expect(buildUrlSearch({ assetId: "refinery-ruwais", view: "map" })).toBe("?asset=refinery-ruwais");
  });

  it("records the table's layer and selection", () => {
    expect(buildUrlSearch({ assetId: "pipeline-p1", layer: "pipelines", view: "table" })).toBe(
      "?view=table&layer=pipelines&asset=pipeline-p1"
    );
  });

  it("records the reference tab and the entry open in it", () => {
    expect(buildUrlSearch({ entryId: "SA", tab: "countries", view: "reference" })).toBe(
      "?view=reference&tab=countries&id=SA"
    );
    expect(buildUrlSearch({ tab: "glossary", view: "reference" })).toBe("?view=reference&tab=glossary");
  });

  it("leaves out anything that does not apply to the view", () => {
    expect(buildUrlSearch({ assetId: "refinery-ruwais", entryId: "SA", layer: "fields", tab: "grades", view: "about" })).toBe(
      "?view=about"
    );
    expect(buildUrlSearch({ assetId: "refinery-ruwais", layer: "fields", view: "reference" })).toBe(
      "?view=reference&tab=countries"
    );
  });
});

describe("parseUrlState", () => {
  it("reads back what buildUrlSearch wrote", () => {
    const states: UrlState[] = [
      { view: "map" },
      { assetId: "refinery-ruwais", view: "map" },
      { assetId: "pipeline-p1", layer: "pipelines", view: "table" },
      { entryId: "saudi-aramco", tab: "operators", view: "reference" },
      { entryId: "API gravity", tab: "glossary", view: "reference" },
      { view: "about" }
    ];

    states.forEach((state) => expect(parseUrlState(buildUrlSearch(state))).toEqual(state));
  });

  it("opens the map when the address says nothing", () => {
    expect(parseUrlState("")).toEqual({ view: "map" });
  });

  it("ignores values it does not recognise", () => {
    expect(parseUrlState("?view=prices&layer=tankers&tab=news")).toEqual({ view: "map" });
    expect(parseUrlState("?view=table&layer=tankers")).toEqual({ view: "table" });
    expect(parseUrlState("?view=reference&tab=news")).toEqual({ tab: "countries", view: "reference" });
  });

  it("ignores parts that belong to another view", () => {
    expect(parseUrlState("?view=about&asset=refinery-ruwais&tab=grades")).toEqual({ view: "about" });
    expect(parseUrlState("?asset=refinery-ruwais&layer=fields&id=SA")).toEqual({ assetId: "refinery-ruwais", view: "map" });
  });
});
