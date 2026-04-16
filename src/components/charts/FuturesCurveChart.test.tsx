import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FuturesCurveChart, computeFuturesCurveGeometry } from "./FuturesCurveChart";
import { buildFuturesCurve } from "../../utils/futuresCurveModel";
import type { IceBrentStripPoint } from "../../types/IceSettlements";

const SEED_OBSERVED_STRIP: IceBrentStripPoint[] = [
  { month: 1, contractCode: "BRN-M26", priceUsd: 92.3 },
  { month: 2, contractCode: "BRN-N26", priceUsd: 90.75 },
  { month: 3, contractCode: "BRN-Q26", priceUsd: 89.4 },
  { month: 4, contractCode: "BRN-U26", priceUsd: 88.2 },
  { month: 5, contractCode: "BRN-V26", priceUsd: 87.1 },
  { month: 6, contractCode: "BRN-X26", priceUsd: 86.1 },
  { month: 7, contractCode: "BRN-Z26", priceUsd: 85.25 },
  { month: 8, contractCode: "BRN-F27", priceUsd: 84.5 },
  { month: 9, contractCode: "BRN-G27", priceUsd: 83.85 },
  { month: 10, contractCode: "BRN-H27", priceUsd: 83.25 },
  { month: 11, contractCode: "BRN-J27", priceUsd: 82.6 },
  { month: 12, contractCode: "BRN-K27", priceUsd: 82.05 }
];

describe("FuturesCurveChart (Phase 1 two-line mode)", () => {
  it("renders the equilibrium regime label at rest", () => {
    const result = buildFuturesCurve(null);
    render(<FuturesCurveChart result={result} />);

    expect(screen.getByText("EQUILIBRIUM")).toBeInTheDocument();
    expect(screen.getByText("ICE BRENT FORWARD CURVE")).toBeInTheDocument();
  });

  it("renders severe backwardation label under a 15-day breach", () => {
    const result = buildFuturesCurve(15);
    render(<FuturesCurveChart result={result} />);

    expect(screen.getByText("SEVERE BACKWARDATION")).toBeInTheDocument();
  });

  it("renders MODEL M1, M12, and spread stat blocks when no observed strip", () => {
    const result = buildFuturesCurve(60);
    render(<FuturesCurveChart result={result} />);

    expect(screen.getByText("MODEL M1")).toBeInTheDocument();
    // "M12" also appears as an x-axis label inside the SVG.
    expect(screen.getAllByText("M12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("M1-M12")).toBeInTheDocument();
  });

  it("does not render the observed legend row without an observed strip", () => {
    const result = buildFuturesCurve(null);
    render(<FuturesCurveChart result={result} />);

    expect(
      screen.getByText("MODEL-IMPLIED SCENARIO CURVE")
    ).toBeInTheDocument();
    expect(screen.getByText(/PEACETIME BENCHMARK/)).toBeInTheDocument();
    expect(screen.queryByText("OBSERVED ICE BRENT STRIP")).toBeNull();
  });
});

describe("FuturesCurveChart (Phase 2 three-line mode with observed strip)", () => {
  it("renders the observed legend row and MKT M1 / ALPHA stat blocks", () => {
    const result = buildFuturesCurve(0); // severe model, M1 = $150
    render(
      <FuturesCurveChart
        result={result}
        observedStrip={SEED_OBSERVED_STRIP}
        observedCadence="EOD"
        observedClassification="CURATED"
        observedAsOf="2026-04-14"
      />
    );

    expect(screen.getByText("OBSERVED ICE BRENT STRIP")).toBeInTheDocument();
    expect(screen.getByText("MKT M1")).toBeInTheDocument();
    expect(screen.getByText("ALPHA (MKT-MODEL)")).toBeInTheDocument();
    expect(screen.getByText("CURATED EOD")).toBeInTheDocument();
    expect(screen.getByText("$92.30")).toBeInTheDocument();
  });

  it("surfaces the alpha narrative beneath the chart", () => {
    const result = buildFuturesCurve(0); // severe model vs $92.30 market
    render(
      <FuturesCurveChart
        result={result}
        observedStrip={SEED_OBSERVED_STRIP}
        observedCadence="EOD"
        observedClassification="CURATED"
        observedAsOf="2026-04-14"
      />
    );

    expect(screen.getByText(/UNDERPRICING/)).toBeInTheDocument();
  });

  it("renders an OBSERVED EOD badge when the strip is observed EOD data", () => {
    const result = buildFuturesCurve(60);
    render(
      <FuturesCurveChart
        result={result}
        observedStrip={SEED_OBSERVED_STRIP}
        observedCadence="EOD"
        observedClassification="OBSERVED"
      />
    );

    expect(screen.getByText("OBSERVED EOD")).toBeInTheDocument();
  });
});

describe("computeFuturesCurveGeometry", () => {
  it("produces an SVG path string covering all 12 months", () => {
    const result = buildFuturesCurve(30);
    const geometry = computeFuturesCurveGeometry(result);

    const commands = geometry.scenarioPath.match(/[ML]/g) ?? [];
    expect(commands).toHaveLength(12);
    expect(geometry.scenarioPath.startsWith("M")).toBe(true);
  });

  it("prompt marker aligns to the first curve point", () => {
    const result = buildFuturesCurve(0);
    const geometry = computeFuturesCurveGeometry(result);

    expect(geometry.promptMarker.x).toBe(geometry.plot.paddingLeft);
  });

  it("observedPath is null when no strip is supplied", () => {
    const result = buildFuturesCurve(15);
    const geometry = computeFuturesCurveGeometry(result);

    expect(geometry.observedPath).toBeNull();
    expect(geometry.observedMarker).toBeNull();
  });

  it("observedPath is a 12-point ML string when a strip is supplied", () => {
    const result = buildFuturesCurve(15);
    const geometry = computeFuturesCurveGeometry(result, SEED_OBSERVED_STRIP);

    expect(geometry.observedPath).not.toBeNull();
    const commands = (geometry.observedPath as string).match(/[ML]/g) ?? [];
    expect(commands).toHaveLength(12);
    expect(geometry.observedMarker).not.toBeNull();
    expect(geometry.observedMarker!.x).toBe(geometry.plot.paddingLeft);
  });

  it("y-axis auto-range expands to include observed series", () => {
    // Model equilibrium ($80-$81.10) vs a stress-priced observed strip
    // ($82-$92). Without including the observed series the top tick
    // would sit at $85 — with it, it has to reach past $92.
    const result = buildFuturesCurve(null);
    const geometry = computeFuturesCurveGeometry(result, SEED_OBSERVED_STRIP);
    const maxTick = Math.max(...geometry.ticks.map((tick) => tick.value));

    expect(maxTick).toBeGreaterThanOrEqual(95);
  });

  it("under severe stress the scenario path rides above the benchmark at M1", () => {
    const severe = computeFuturesCurveGeometry(buildFuturesCurve(0));

    const firstY = (path: string) => {
      const match = path.match(/^M[\d.-]+,([\d.-]+)/);
      expect(match).not.toBeNull();
      return Number(match![1]);
    };

    const severeY = firstY(severe.scenarioPath);
    expect(severeY).toBeLessThan(
      severe.plot.paddingTop + severe.plot.height * 0.25
    );
  });

  it("geometry ticks are sorted and cover the y-range", () => {
    const result = buildFuturesCurve(15);
    const geometry = computeFuturesCurveGeometry(result);

    expect(geometry.ticks.length).toBeGreaterThanOrEqual(5);
    for (const tick of geometry.ticks) {
      expect(tick.y).toBeGreaterThanOrEqual(geometry.plot.paddingTop - 1);
      expect(tick.y).toBeLessThanOrEqual(
        geometry.plot.height - geometry.plot.paddingBottom + 1
      );
    }
  });
});
