import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutPage } from "./AboutPage";
import { makeCatalog, makeCatalogEntry } from "../test/fixtures";

describe("AboutPage", () => {
  it("says what the project is in one line", () => {
    render(<AboutPage catalog={makeCatalog()} />);

    expect(screen.getByRole("heading", { name: "ATLAS / ABOUT" })).toBeInTheDocument();
    expect(screen.getByText(/built from open datasets as a student project/)).toBeInTheDocument();
  });

  it("lists each layer's source, licence, download date and record count", () => {
    render(
      <AboutPage
        catalog={[
          makeCatalogEntry("refineries", {
            downloadDate: "2025-03-28",
            recordCount: 53,
            source: "EDF OGIM v2.7",
            sourceUrl: "https://zenodo.org/records/15103476"
          })
        ]}
      />
    );

    const row = screen.getByText("REFINERIES").closest("tr") as HTMLElement;

    expect(within(row).getByRole("link", { name: "EDF OGIM v2.7" })).toHaveAttribute(
      "href",
      "https://zenodo.org/records/15103476"
    );
    expect(within(row).getByText("CC BY 4.0")).toBeInTheDocument();
    expect(within(row).getByText("2025-03-28")).toBeInTheDocument();
    expect(within(row).getByText("53")).toBeInTheDocument();
  });

  it("explains the map encoding", () => {
    render(<AboutPage catalog={makeCatalog()} />);

    expect(screen.getByText(/Shape is the kind of asset/)).toBeInTheDocument();
    expect(screen.getByText(/Colour is the energy it handles/)).toBeInTheDocument();
  });

  it("carries no list of caveats", () => {
    render(<AboutPage catalog={makeCatalog()} />);

    expect(screen.queryByText("KNOWN LIMITS")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "HOW TO READ THE MAP",
      "DATA SOURCES"
    ]);
  });
});
