import { describe, expect, it } from "vitest";
import { formatDailyVolume, formatLengthKm, formatMtpa, formatStatusLabel } from "./formatters";

describe("formatters", () => {
  it("formats daily volumes with thousands separators and a unit", () => {
    expect(formatDailyVolume(837000)).toBe("837,000 BPD");
    expect(formatDailyVolume(5000000, "BOE/D")).toBe("5,000,000 BOE/D");
  });

  it("rounds fractional volumes and lengths to whole units", () => {
    expect(formatDailyVolume(1234.6)).toBe("1,235 BPD");
    expect(formatLengthKm(83.4)).toBe("83 KM");
  });

  it("keeps one decimal for LNG capacity", () => {
    expect(formatMtpa(25.28)).toBe("25.3 MTPA");
  });

  it("turns raw status strings into display labels", () => {
    expect(formatStatusLabel("in_development")).toBe("IN DEVELOPMENT");
    expect(formatStatusLabel("natural_gas")).toBe("NATURAL GAS");
  });
});
