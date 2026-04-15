import {
  loadFirmsDetections,
  loadStaticFirmsDetections,
  normalizeConfidence,
  parseFirmsCsv
} from "./firms";

describe("normalizeConfidence", () => {
  it("maps the three canonical VIIRS strings", () => {
    expect(normalizeConfidence("low")).toBe(40);
    expect(normalizeConfidence("nominal")).toBe(75);
    expect(normalizeConfidence("high")).toBe(95);
  });

  it("is case and whitespace insensitive", () => {
    expect(normalizeConfidence("  HIGH ")).toBe(95);
    expect(normalizeConfidence("Nominal")).toBe(75);
    expect(normalizeConfidence("LOW")).toBe(40);
  });

  it("accepts the short-form VIIRS codes l/n/h", () => {
    expect(normalizeConfidence("l")).toBe(40);
    expect(normalizeConfidence("n")).toBe(75);
    expect(normalizeConfidence("h")).toBe(95);
  });

  it("passes MODIS numeric confidence through and clamps to [0,100]", () => {
    expect(normalizeConfidence(0)).toBe(0);
    expect(normalizeConfidence(65)).toBe(65);
    expect(normalizeConfidence(100)).toBe(100);
    expect(normalizeConfidence(120)).toBe(100);
    expect(normalizeConfidence(-5)).toBe(0);
  });

  it("parses MODIS-style numeric strings that slipped into the VIIRS branch", () => {
    expect(normalizeConfidence("88")).toBe(88);
  });

  it("returns 0 for unknown inputs so they fail threshold filters", () => {
    expect(normalizeConfidence("unknown")).toBe(0);
    expect(normalizeConfidence(Number.NaN)).toBe(0);
    expect(normalizeConfidence("")).toBe(0);
  });
});

describe("parseFirmsCsv", () => {
  const viirsCsv = [
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type",
    "29.1234,48.5678,320.2,0.40,0.40,2026-04-14,0915,N,VIIRS,nominal,2.0NRT,289.1,14.2,D,0",
    "24.5000,51.2500,340.7,0.45,0.42,2026-04-14,1130,N,VIIRS,high,2.0NRT,295.5,28.8,D,0"
  ].join("\n");

  it("parses VIIRS CSV rows into normalised detections", () => {
    const detections = parseFirmsCsv(viirsCsv);
    expect(detections).toHaveLength(2);

    const [first, second] = detections;
    expect(first.latitude).toBe(29.1234);
    expect(first.longitude).toBe(48.5678);
    expect(first.confidenceRaw).toBe("nominal");
    expect(first.confidenceScore).toBe(75);
    expect(first.satellite).toBe("VIIRS_SNPP");
    expect(first.dayNight).toBe("D");
    expect(first.frp).toBe(14.2);
    expect(first.acquiredAt).toBe("2026-04-14T09:15:00Z");

    expect(second.confidenceRaw).toBe("high");
    expect(second.confidenceScore).toBe(95);
  });

  it("emits stable composite IDs that are unique across rows", () => {
    const detections = parseFirmsCsv(viirsCsv);
    const ids = new Set(detections.map((d) => d.id));
    expect(ids.size).toBe(detections.length);
    expect(detections[0].id).toContain("2026-04-14");
  });

  it("drops malformed rows without throwing", () => {
    const messy = [
      "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type",
      "not-a-lat,48.0,320,0.4,0.4,2026-04-14,0915,N,VIIRS,nominal,2.0NRT,289,14,D,0",
      "29.0,48.0,320,0.4,0.4,not-a-date,0915,N,VIIRS,high,2.0NRT,289,14,D,0",
      "29.1,48.1,321,0.4,0.4,2026-04-14,1200,N,VIIRS,nominal,2.0NRT,289,14,D,0",
      "30.0" // truncated row
    ].join("\n");

    const detections = parseFirmsCsv(messy);
    expect(detections).toHaveLength(1);
    expect(detections[0].latitude).toBe(29.1);
  });

  it("returns an empty list for empty or header-only input", () => {
    expect(parseFirmsCsv("")).toEqual([]);
    expect(parseFirmsCsv("latitude,longitude,acq_date,acq_time")).toEqual([]);
  });

  it("detects MODIS instrument and uses numeric confidence", () => {
    const modisCsv = [
      "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type",
      "25.0,50.5,330.1,1.0,1.0,2026-04-14,1045,Aqua,MODIS,87,6.1NRT,299.0,21.5,D,0"
    ].join("\n");

    const detections = parseFirmsCsv(modisCsv);
    expect(detections).toHaveLength(1);
    expect(detections[0].satellite).toBe("MODIS_AQUA");
    expect(detections[0].confidenceRaw).toBe(87);
    expect(detections[0].confidenceScore).toBe(87);
  });
});

describe("loadStaticFirmsDetections", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the static snapshot and applies the confidence filter", async () => {
    const payload = {
      asOf: "2026-04-14T12:00:00Z",
      source: "test",
      detections: [
        {
          id: "hit-1",
          latitude: 29.0,
          longitude: 48.0,
          acquiredAt: "2026-04-14T10:00:00Z",
          satellite: "VIIRS_SNPP",
          confidenceRaw: "high",
          confidenceScore: 95,
          frp: 12,
          dayNight: "D",
          brightness: 330
        },
        {
          id: "miss-1",
          latitude: 29.1,
          longitude: 48.1,
          acquiredAt: "2026-04-14T10:00:00Z",
          satellite: "VIIRS_SNPP",
          confidenceRaw: "low",
          confidenceScore: 40,
          frp: 5,
          dayNight: "D",
          brightness: 310
        }
      ]
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/firms/recent_detections.json") {
          return { ok: true, json: async () => payload };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadStaticFirmsDetections({
      windowHours: 72,
      confidenceThreshold: 80
    });

    expect(snapshot.mode).toBe("STATIC_SNAPSHOT");
    expect(snapshot.detections).toHaveLength(1);
    expect(snapshot.detections[0].id).toBe("hit-1");
  });
});

describe("loadFirmsDetections", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls back to the static snapshot when VITE_FIRMS_MAP_KEY is missing", async () => {
    vi.stubEnv("VITE_FIRMS_MAP_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/data/firms/recent_detections.json") {
          return {
            ok: true,
            json: async () => ({
              asOf: "2026-04-14T12:00:00Z",
              source: "static",
              detections: [
                {
                  id: "s1",
                  latitude: 29.0,
                  longitude: 48.0,
                  acquiredAt: "2026-04-14T10:00:00Z",
                  satellite: "VIIRS_SNPP",
                  confidenceRaw: "high",
                  confidenceScore: 95,
                  frp: 12,
                  dayNight: "D",
                  brightness: 330
                }
              ]
            })
          };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadFirmsDetections({
      windowHours: 72,
      confidenceThreshold: 80
    });

    expect(snapshot.mode).toBe("STATIC_SNAPSHOT");
    expect(snapshot.detections).toHaveLength(1);
  });

  it("falls back to static when every live country leg fails (401)", async () => {
    vi.stubEnv("VITE_FIRMS_MAP_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("firms.modaps.eosdis")) {
          return { ok: false, status: 401, text: async () => "Unauthorized" };
        }
        if (input === "/data/firms/recent_detections.json") {
          return {
            ok: true,
            json: async () => ({
              asOf: "2026-04-14T12:00:00Z",
              source: "static-fallback",
              detections: [
                {
                  id: "s-fallback",
                  latitude: 25.0,
                  longitude: 50.0,
                  acquiredAt: "2026-04-14T09:00:00Z",
                  satellite: "VIIRS_SNPP",
                  confidenceRaw: "high",
                  confidenceScore: 95,
                  frp: 10,
                  dayNight: "D",
                  brightness: 320
                }
              ]
            })
          };
        }
        throw new Error(`Unexpected fetch: ${input}`);
      })
    );

    const snapshot = await loadFirmsDetections({
      windowHours: 72,
      confidenceThreshold: 80
    });

    expect(snapshot.mode).toBe("STATIC_SNAPSHOT");
    expect(snapshot.source).toBe("static-fallback");
  });
});
