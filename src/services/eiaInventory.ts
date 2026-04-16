import type {
  EiaWeeklyInventoryLatestSummary,
  EiaWeeklyInventoryPoint,
  EiaWeeklyInventorySnapshot
} from "../types/Market";

const STATIC_SNAPSHOT_PATH = "/data/market/eia_us_crude_inventories_5y.json";

export async function loadEiaWeeklyInventorySnapshot(): Promise<EiaWeeklyInventorySnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load EIA inventory snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as EiaWeeklyInventorySnapshot;
  const series = normaliseInventorySeries(payload.series);

  if (series.length === 0) {
    throw new Error("EIA inventory snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    cadence: "WEEKLY",
    classification: "OBSERVED",
    latest: buildInventoryLatestSummary(series[series.length - 1]),
    note: payload.note,
    series,
    seriesName: payload.seriesName ?? "US COMMERCIAL CRUDE EX SPR",
    source: payload.source,
    units: "million_barrels"
  };
}

export function normaliseInventorySeries(
  raw: EiaWeeklyInventoryPoint[] | undefined
): EiaWeeklyInventoryPoint[] {
  if (!raw) {
    return [];
  }

  return raw
    .filter((point) => {
      return (
        typeof point.date === "string" &&
        point.date.length > 0 &&
        Number.isFinite(point.value) &&
        Number.isFinite(point.fiveYearAverage) &&
        Number.isFinite(point.fiveYearMin) &&
        Number.isFinite(point.fiveYearMax)
      );
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function buildInventoryLatestSummary(
  latestPoint: EiaWeeklyInventoryPoint
): EiaWeeklyInventoryLatestSummary {
  const deltaVsAverage = round2(latestPoint.value - latestPoint.fiveYearAverage);
  const deltaPctVsAverage =
    latestPoint.fiveYearAverage !== 0
      ? round2((deltaVsAverage / latestPoint.fiveYearAverage) * 100)
      : 0;
  const rangeWidth = latestPoint.fiveYearMax - latestPoint.fiveYearMin;
  const rawRangePosition =
    rangeWidth > 0 ? (latestPoint.value - latestPoint.fiveYearMin) / rangeWidth : 0.5;
  const rangePosition = round3(clamp(rawRangePosition, 0, 1));

  return {
    date: latestPoint.date,
    value: latestPoint.value,
    fiveYearAverage: latestPoint.fiveYearAverage,
    fiveYearMin: latestPoint.fiveYearMin,
    fiveYearMax: latestPoint.fiveYearMax,
    deltaVsAverage,
    deltaPctVsAverage,
    rangePosition,
    rangePositionLabel:
      latestPoint.value < latestPoint.fiveYearMin
        ? "BELOW_RANGE"
        : latestPoint.value > latestPoint.fiveYearMax
          ? "ABOVE_RANGE"
          : "WITHIN_RANGE"
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
