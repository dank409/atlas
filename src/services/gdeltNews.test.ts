import {
  loadGdeltNewsSnapshot,
  normaliseArticles,
  parseGdeltSeenDate
} from "./gdeltNews";
import type { GdeltNewsSnapshot, GdeltRawArticle } from "../types/Gdelt";

// These tests mock `fetch` outright. We are NOT hitting the live GDELT
// API from CI — GDELT enforces a 1 req/5s per-IP rate limit that would
// make a shared CI runner flaky within hours. The live endpoint was
// verified manually during service construction (see service file
// header comment).

const SAMPLE_ARTICLES: GdeltRawArticle[] = [
  {
    url: "https://example.com/a",
    title: "  Hormuz   transit   halted  ",
    seendate: "20260415T091500Z",
    domain: "example.com",
    language: "English",
    sourcecountry: "United States"
  },
  {
    url: "https://example.com/b",
    title: "OPEC holds production target",
    seendate: "20260415T080000Z",
    domain: "example.com",
    language: "English",
    sourcecountry: "United Kingdom"
  },
  {
    // Duplicate URL — should be dropped
    url: "https://example.com/a",
    title: "Duplicate",
    seendate: "20260415T070000Z",
    domain: "example.com",
    language: "English",
    sourcecountry: "United States"
  },
  {
    // Unparseable date — should be dropped
    url: "https://example.com/c",
    title: "Unparseable date",
    seendate: "not-a-date",
    domain: "example.com",
    language: "English",
    sourcecountry: "United States"
  }
];

describe("parseGdeltSeenDate", () => {
  it("converts GDELT compact ISO to standard ISO 8601", () => {
    expect(parseGdeltSeenDate("20260415T091500Z")).toBe(
      "2026-04-15T09:15:00Z"
    );
  });

  it("returns empty string for malformed input", () => {
    expect(parseGdeltSeenDate("2026-04-15")).toBe("");
    expect(parseGdeltSeenDate("")).toBe("");
    expect(parseGdeltSeenDate(undefined)).toBe("");
  });

  it("rejects strings missing the Z suffix", () => {
    expect(parseGdeltSeenDate("20260415T091500")).toBe("");
  });
});

describe("normaliseArticles", () => {
  it("trims whitespace-noisy titles", () => {
    const [first] = normaliseArticles([SAMPLE_ARTICLES[0]]);
    expect(first.title).toBe("Hormuz transit halted");
  });

  it("dedupes by URL and drops unparseable dates", () => {
    const headlines = normaliseArticles(SAMPLE_ARTICLES);
    expect(headlines).toHaveLength(2);
    const urls = headlines.map((headline) => headline.url);
    expect(urls).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("sorts most-recent-first", () => {
    const headlines = normaliseArticles(SAMPLE_ARTICLES);
    expect(headlines[0].publishedAt > headlines[1].publishedAt).toBe(true);
  });

  it("returns an empty list when given garbage", () => {
    expect(normaliseArticles([])).toEqual([]);
  });
});

describe("loadGdeltNewsSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an observed snapshot when GDELT responds with articles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("api.gdeltproject.org")) {
          return {
            ok: true,
            headers: new Headers({
              "content-type": "application/json; charset=utf-8"
            }),
            json: async () => ({ articles: SAMPLE_ARTICLES })
          };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadGdeltNewsSnapshot();

    expect(snapshot.classification).toBe("OBSERVED");
    expect(snapshot.cadence).toBe("CURATED");
    expect(snapshot.headlines.length).toBeGreaterThan(0);
    expect(snapshot.query).toContain("Hormuz");
  });

  it("falls back to a curated snapshot when GDELT returns a plain-text error", async () => {
    const staticPayload: GdeltNewsSnapshot = {
      asOf: "2026-04-14T00:00:00Z",
      cadence: "CURATED",
      classification: "CURATED",
      query: "seed",
      headlines: [
        {
          url: "https://seed.example/a",
          title: "Seed headline",
          publishedAt: "2026-04-14T00:00:00Z",
          domain: "seed.example",
          sourceCountry: "United States",
          language: "English"
        }
      ],
      source: "seed"
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("api.gdeltproject.org")) {
          // GDELT rate-limit rejection — 200 OK but text/plain body.
          return {
            ok: true,
            headers: new Headers({ "content-type": "text/plain" }),
            json: async () => {
              throw new Error("not json");
            }
          };
        }
        if (input === "/data/news/gdelt_seed.json") {
          return {
            ok: true,
            json: async () => staticPayload
          };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadGdeltNewsSnapshot();

    expect(snapshot.cadence).toBe("CURATED");
    expect(snapshot.classification).toBe("CURATED");
    expect(snapshot.headlines).toHaveLength(1);
    expect(snapshot.headlines[0].title).toBe("Seed headline");
  });

  it("falls back to a curated snapshot when GDELT returns an empty article list", async () => {
    const staticPayload: GdeltNewsSnapshot = {
      asOf: "2026-04-14T00:00:00Z",
      cadence: "CURATED",
      classification: "CURATED",
      query: "seed",
      headlines: [
        {
          url: "https://seed.example/a",
          title: "Fallback headline",
          publishedAt: "2026-04-14T00:00:00Z",
          domain: "seed.example",
          sourceCountry: "United States",
          language: "English"
        }
      ],
      source: "seed"
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("api.gdeltproject.org")) {
          return {
            ok: true,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ articles: [] })
          };
        }
        if (input === "/data/news/gdelt_seed.json") {
          return {
            ok: true,
            json: async () => staticPayload
          };
        }
        throw new Error(`Unexpected fetch call: ${input}`);
      })
    );

    const snapshot = await loadGdeltNewsSnapshot();
    expect(snapshot.cadence).toBe("CURATED");
    expect(snapshot.classification).toBe("CURATED");
    expect(snapshot.headlines[0].title).toBe("Fallback headline");
  });
});
