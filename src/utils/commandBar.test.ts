import { describe, expect, it } from "vitest";
import { resolveTerminalCommand } from "./commandBar";
import type { InfrastructureAsset } from "../types/Infrastructure";

const assets: InfrastructureAsset[] = [
  {
    assetKind: "refinery",
    datasetId: "refineries",
    id: "refinery-ruwais",
    name: "Ruwais Refinery",
    country: "AE",
    countryName: "United Arab Emirates",
    owner: "Abu Dhabi National Oil Company",
    operator: "ADNOC Refining",
    status: "unknown",
    capacityUnit: "bpd",
    lat: 24.1108,
    lon: 54.0894,
    _metadata: {
      source: "OGIM",
      downloadDate: "2026-04-14"
    }
  },
  {
    assetKind: "pipeline",
    datasetId: "pipelines",
    id: "pipeline-east-west",
    name: "East-West Crude Oil Pipeline",
    country: "SA",
    countryName: "Saudi Arabia",
    owner: "Saudi Arabian Oil Company",
    operator: "Saudi Arabian Oil Company",
    status: "operating",
    hydrocarbon: "crude_oil",
    geometryConfidence: "high",
    geometry: {
      type: "LineString",
      coordinates: [
        [49.6778, 25.9344],
        [38.0617, 24.0889]
      ]
    },
    _metadata: {
      source: "GEM",
      downloadDate: "2026-04-14"
    }
  }
];

describe("resolveTerminalCommand", () => {
  it("resolves direct view commands", () => {
    expect(resolveTerminalCommand("dash", assets)).toEqual({
      activityLabel: "OPEN DASHBOARD",
      kind: "view",
      view: "dash"
    });
    expect(resolveTerminalCommand("map", assets)).toEqual({
      activityLabel: "OPEN MAP",
      kind: "view",
      view: "map"
    });
  });

  it("resolves asset commands by dataset alias and query", () => {
    expect(resolveTerminalCommand("ref ruwais", assets)).toEqual({
      activityLabel: "SELECT RUWAIS REFINERY",
      assetId: "refinery-ruwais",
      kind: "asset"
    });
    expect(resolveTerminalCommand("pipe east-west", assets)).toEqual({
      activityLabel: "SELECT EAST-WEST CRUDE OIL PIPELINE",
      assetId: "pipeline-east-west",
      kind: "asset"
    });
  });

  it("resolves dataset-only commands into focus intents", () => {
    expect(resolveTerminalCommand("pipe", assets)).toEqual({
      activityLabel: "FOCUS DATASET PIPELINES",
      datasetId: "pipelines",
      kind: "dataset"
    });
  });

  it("returns null for unrecognized commands", () => {
    expect(resolveTerminalCommand("wti", assets)).toBeNull();
  });
});
