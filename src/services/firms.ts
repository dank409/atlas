import type {
  FirmsDetection,
  FirmsSnapshot,
  FirmsWindowHours
} from "../types/firms";

// NASA FIRMS service. CLAUDE.md P0 #10 and FIRMS Implementation Notes.
//
// Live endpoint (no JSON equivalent — FIRMS serves CSV):
//   https://firms.modaps.eosdis.nasa.gov/api/country/csv/<KEY>/VIIRS_SNPP_NRT/<ISO3>/<DAYS>
//
// The live path fans out per country (FIRMS has no multi-country query)
// and merges results. A single failed country leg does NOT poison the
// snapshot — we log and continue, because "20 of 15 countries returned
// fire data" is still actionable. A failure of EVERY leg falls through
// to the static snapshot path (CLAUDE.md Data Integrity Rule #6).
//
// Confidence normalisation: VIIRS emits strings (low/nominal/high),
// MODIS emits numbers (0-100). We normalise both to 0-100 so downstream
// filtering ("confidence >= 80") has a single axis to work against.

const STATIC_SNAPSHOT_PATH = "/data/firms/recent_detections.json";
const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/country/csv";
const FIRMS_SOURCE = "VIIRS_SNPP_NRT";

// Middle East + adjacent non-Gulf producers covered by the map.
// Order doesn't matter — we Promise.allSettled and merge.
const FIRMS_COUNTRIES: readonly string[] = [
  "SAU",
  "IRN",
  "IRQ",
  "KWT",
  "ARE",
  "QAT",
  "BHR",
  "OMN",
  "YEM",
  "EGY",
  "JOR",
  "LBN",
  "SYR",
  "TUR"
];

export interface LoadFirmsArgs {
  windowHours: FirmsWindowHours;
  confidenceThreshold: number;
}

/**
 * Fetch + sanitise + confidence-filter detections. This function
 * returns ONLY the raw detection list plus mode — downstream callers
 * (hooks/useFirms) layer geofencing and anomaly scoring on top.
 *
 * The return shape is a partial FirmsSnapshot so the hook can fill in
 * `matches` and `anomalies` without a second round trip. An empty
 * `matches`/`anomalies` is the honest default here.
 */
export async function loadFirmsDetections(
  args: LoadFirmsArgs
): Promise<Omit<FirmsSnapshot, "matches" | "anomalies">> {
  const mapKey = import.meta.env.VITE_FIRMS_MAP_KEY;
  const days = hoursToFirmsDays(args.windowHours);

  if (typeof mapKey === "string" && mapKey.length > 0) {
    try {
      const liveDetections = await fetchLiveFirmsDetections(mapKey, days);
      const filtered = filterByConfidence(liveDetections, args.confidenceThreshold);
      if (filtered.length > 0) {
        return {
          mode: "LIVE",
          asOf: new Date().toISOString(),
          windowHours: args.windowHours,
          confidenceThreshold: args.confidenceThreshold,
          detections: filtered,
          source: "NASA FIRMS VIIRS_SNPP_NRT (live)"
        };
      }
      // Empty live response is not an error — but the tape still needs
      // something to show, so fall through to the static snapshot.
    } catch {
      // Live fetch failed — fall through. Typical causes: missing /
      // revoked key, CORS block on a transient mirror, 429 rate limit.
    }
  }

  return loadStaticFirmsDetections(args);
}

/**
 * Static-snapshot loader. Returns the checked-in synthetic detection
 * set filtered by confidence. Exported for tests.
 */
export async function loadStaticFirmsDetections(
  args: LoadFirmsArgs
): Promise<Omit<FirmsSnapshot, "matches" | "anomalies">> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load static FIRMS snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as StaticFirmsPayload;
  const raw = Array.isArray(payload.detections) ? payload.detections : [];
  const detections = raw
    .map(rehydrateStaticDetection)
    .filter((detection): detection is FirmsDetection => detection !== null);

  const filtered = filterByConfidence(detections, args.confidenceThreshold);

  return {
    mode: "STATIC_SNAPSHOT",
    asOf: payload.asOf ?? new Date().toISOString(),
    windowHours: args.windowHours,
    confidenceThreshold: args.confidenceThreshold,
    detections: filtered,
    source: payload.source ?? "Curated FIRMS static snapshot"
  };
}

interface StaticFirmsPayload {
  asOf?: string;
  source?: string;
  detections?: Array<Partial<FirmsDetection>>;
}

function rehydrateStaticDetection(raw: Partial<FirmsDetection>): FirmsDetection | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.latitude !== "number" ||
    typeof raw.longitude !== "number" ||
    typeof raw.acquiredAt !== "string"
  ) {
    return null;
  }

  const confidenceRaw = raw.confidenceRaw ?? 0;
  const confidenceScore =
    typeof raw.confidenceScore === "number"
      ? raw.confidenceScore
      : normalizeConfidence(confidenceRaw);

  return {
    id: raw.id,
    latitude: raw.latitude,
    longitude: raw.longitude,
    acquiredAt: raw.acquiredAt,
    satellite: raw.satellite ?? "VIIRS_SNPP",
    confidenceRaw,
    confidenceScore,
    frp: typeof raw.frp === "number" ? raw.frp : 0,
    dayNight: raw.dayNight === "N" ? "N" : "D",
    brightness: typeof raw.brightness === "number" ? raw.brightness : 0
  };
}

async function fetchLiveFirmsDetections(
  mapKey: string,
  days: number
): Promise<FirmsDetection[]> {
  const countryRequests = FIRMS_COUNTRIES.map(async (iso3) => {
    const url = `${FIRMS_BASE}/${encodeURIComponent(mapKey)}/${FIRMS_SOURCE}/${iso3}/${days}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FIRMS ${iso3} ${response.status}`);
    }
    const text = await response.text();
    return parseFirmsCsv(text);
  });

  const settled = await Promise.allSettled(countryRequests);
  const detections: FirmsDetection[] = [];
  let anyFulfilled = false;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      anyFulfilled = true;
      detections.push(...result.value);
    }
  }

  if (!anyFulfilled) {
    throw new Error("All FIRMS country legs failed");
  }

  return detections;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Minimal FIRMS-CSV parser. FIRMS emits a stable header row + one
 * comma-separated record per detection. We do not use a full CSV
 * library because the format is flat (no quoted commas, no escapes)
 * — a hand-rolled split is both faster and one less dep.
 *
 * Exported for tests.
 */
export function parseFirmsCsv(raw: string): FirmsDetection[] {
  if (!raw || typeof raw !== "string") {
    return [];
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split(",").map((col) => col.trim().toLowerCase());
  const columnIndex = (name: string) => header.indexOf(name);

  const latIdx = columnIndex("latitude");
  const lonIdx = columnIndex("longitude");
  const confIdx = columnIndex("confidence");
  const dateIdx = columnIndex("acq_date");
  const timeIdx = columnIndex("acq_time");
  const satIdx = columnIndex("satellite");
  const instIdx = columnIndex("instrument");
  const frpIdx = columnIndex("frp");
  const dnIdx = columnIndex("daynight");
  // VIIRS uses bright_ti4, MODIS uses brightness — prefer whichever exists.
  const brightIdx =
    columnIndex("bright_ti4") !== -1
      ? columnIndex("bright_ti4")
      : columnIndex("brightness");

  const detections: FirmsDetection[] = [];

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const columns = lines[rowIndex].split(",");
    if (columns.length < header.length) {
      // Malformed row — skip rather than guess.
      continue;
    }

    const latitude = Number(columns[latIdx]);
    const longitude = Number(columns[lonIdx]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    const acqDate = (columns[dateIdx] ?? "").trim();
    const acqTime = (columns[timeIdx] ?? "").trim();
    const acquiredAt = combineFirmsDateTime(acqDate, acqTime);
    if (!acquiredAt) {
      continue;
    }

    const satelliteRaw = (columns[satIdx] ?? "").trim();
    const instrumentRaw = (columns[instIdx] ?? "").trim();
    const satellite = resolveSatellite(satelliteRaw, instrumentRaw);

    const confidenceRaw: string | number =
      satellite.startsWith("VIIRS")
        ? (columns[confIdx] ?? "").trim().toLowerCase()
        : Number(columns[confIdx]);
    const confidenceScore = normalizeConfidence(confidenceRaw);

    const frp = Number(columns[frpIdx]);
    const brightness = Number(columns[brightIdx]);
    const dayNight = (columns[dnIdx] ?? "D").trim().toUpperCase() === "N" ? "N" : "D";

    const id = `${latitude}|${longitude}|${acqDate}|${acqTime}|${satellite}`;

    detections.push({
      id,
      latitude,
      longitude,
      acquiredAt,
      satellite,
      confidenceRaw,
      confidenceScore,
      frp: Number.isFinite(frp) ? frp : 0,
      dayNight,
      brightness: Number.isFinite(brightness) ? brightness : 0
    });
  }

  return detections;
}

/**
 * Normalises FIRMS confidence values to a 0-100 scale.
 *
 *   VIIRS (string):
 *     "low"     -> 40
 *     "nominal" -> 75
 *     "high"    -> 95
 *   MODIS (number 0-100):
 *     passthrough, clamped to [0, 100]
 *
 * Unknown inputs return 0, which guarantees they fail any confidence
 * threshold and are dropped.
 *
 * Exported for tests.
 */
export function normalizeConfidence(raw: string | number): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.max(0, Math.min(100, raw));
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "low" || normalized === "l") return 40;
    if (normalized === "nominal" || normalized === "n") return 75;
    if (normalized === "high" || normalized === "h") return 95;
    // MODIS-style numeric string slipped into the VIIRS branch.
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed));
    }
  }

  return 0;
}

function filterByConfidence(
  detections: FirmsDetection[],
  threshold: number
): FirmsDetection[] {
  return detections.filter((detection) => detection.confidenceScore >= threshold);
}

function combineFirmsDateTime(acqDate: string, acqTime: string): string {
  // acq_date: "2026-04-14", acq_time: "0915" (HHMM, zero-padded).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(acqDate)) {
    return "";
  }
  const paddedTime = acqTime.padStart(4, "0");
  if (!/^\d{4}$/.test(paddedTime)) {
    return "";
  }
  const hours = paddedTime.slice(0, 2);
  const minutes = paddedTime.slice(2, 4);
  return `${acqDate}T${hours}:${minutes}:00Z`;
}

function resolveSatellite(
  rawSatellite: string,
  rawInstrument: string
): FirmsDetection["satellite"] {
  const sat = rawSatellite.toLowerCase();
  const inst = rawInstrument.toLowerCase();

  if (inst.includes("modis")) {
    return sat.includes("aqua") ? "MODIS_AQUA" : "MODIS_TERRA";
  }
  // VIIRS: satellite is typically "N" (SNPP) or "N20" (NOAA-20).
  if (sat.includes("noaa") || sat === "n20" || sat === "1") {
    return "VIIRS_NOAA20";
  }
  return "VIIRS_SNPP";
}

function hoursToFirmsDays(windowHours: FirmsWindowHours): number {
  // FIRMS country endpoint accepts day counts 1-10.
  if (windowHours <= 24) return 1;
  if (windowHours <= 72) return 3;
  return 7;
}
