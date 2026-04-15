import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewsTicker, formatRelativeTime } from "./NewsTicker";
import type { GdeltNewsSnapshot } from "../../types/Gdelt";

const SAMPLE_SNAPSHOT: GdeltNewsSnapshot = {
  asOf: "2026-04-15T12:00:00Z",
  mode: "LIVE",
  query: '"Strait of Hormuz" sourcelang:eng',
  source: "GDELT 2.0 Doc API (live)",
  headlines: [
    {
      url: "https://example.com/a",
      title: "Hormuz transit halted as insurance premiums spike",
      publishedAt: "2026-04-15T11:45:00Z",
      domain: "example.com",
      sourceCountry: "United Kingdom",
      language: "English"
    },
    {
      url: "https://example.com/b",
      title: "ADNOC reaffirms Fujairah capacity",
      publishedAt: "2026-04-15T08:00:00Z",
      domain: "example.com",
      sourceCountry: "United Arab Emirates",
      language: "English"
    }
  ]
};

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-15T12:00:00Z");

  it("renders minutes for recent items", () => {
    expect(formatRelativeTime("2026-04-15T11:45:00Z", now)).toBe("15M AGO");
  });

  it("renders hours once past 60 minutes", () => {
    expect(formatRelativeTime("2026-04-15T07:00:00Z", now)).toBe("5H AGO");
  });

  it("renders days once past 48 hours", () => {
    expect(formatRelativeTime("2026-04-12T12:00:00Z", now)).toBe("3D AGO");
  });

  it("uses JUST NOW for timestamps under a minute old", () => {
    expect(formatRelativeTime("2026-04-15T11:59:30Z", now)).toBe("JUST NOW");
  });

  it("returns a safe placeholder for unparseable input", () => {
    expect(formatRelativeTime("", now)).toBe("--");
  });

  it("handles future timestamps gracefully", () => {
    expect(formatRelativeTime("2026-04-15T13:00:00Z", now)).toBe("JUST NOW");
  });
});

describe("NewsTicker", () => {
  it("renders headlines with domain and source country", () => {
    const { container } = render(
      <NewsTicker snapshot={SAMPLE_SNAPSHOT} isLoading={false} error={null} />
    );

    expect(
      screen.getByText("Hormuz transit halted as insurance premiums spike")
    ).toBeInTheDocument();
    expect(screen.getByText("ADNOC reaffirms Fujairah capacity")).toBeInTheDocument();
    // Source country is rendered inside the meta span alongside the
    // domain. We assert against the full container textContent because
    // the text is split across multiple text nodes in one span.
    expect(container.textContent).toContain("United Arab Emirates");
    expect(container.textContent).toContain("example.com");
  });

  it("shows a loading placeholder before the first snapshot lands", () => {
    render(<NewsTicker snapshot={null} isLoading={true} error={null} />);
    expect(screen.getByText(/FETCHING GDELT HEADLINES/)).toBeInTheDocument();
  });

  it("shows an error placeholder when the load fails with no snapshot", () => {
    render(
      <NewsTicker
        snapshot={null}
        isLoading={false}
        error={new Error("boom")}
      />
    );
    expect(screen.getByText(/GDELT FEED UNAVAILABLE/)).toBeInTheDocument();
  });

  it("prefers the snapshot over a stale error state", () => {
    render(
      <NewsTicker
        snapshot={SAMPLE_SNAPSHOT}
        isLoading={false}
        error={new Error("previously failed")}
      />
    );
    expect(
      screen.getByText("Hormuz transit halted as insurance premiums spike")
    ).toBeInTheDocument();
    expect(screen.queryByText(/GDELT FEED UNAVAILABLE/)).toBeNull();
  });

  it("renders anchor tags pointing to the original source URL", () => {
    render(
      <NewsTicker snapshot={SAMPLE_SNAPSHOT} isLoading={false} error={null} />
    );
    const link = screen.getByText(
      "Hormuz transit halted as insurance premiums spike"
    ) as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.href).toBe("https://example.com/a");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noreferrer");
  });

  it("renders the source line with the GDELT query for provenance", () => {
    const { container } = render(
      <NewsTicker snapshot={SAMPLE_SNAPSHOT} isLoading={false} error={null} />
    );
    expect(container.textContent).toContain("Strait of Hormuz");
    expect(container.textContent).toContain("GDELT 2.0 Doc API (live)");
  });
});
