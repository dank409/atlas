import { describe, expect, it } from "vitest";
import { splitPipelineRoute } from "./pipelineRoute";

// Points about 11 km apart along a parallel, so a run of them is a mapped route.
const A: [number, number] = [49.0, 26.0];
const B: [number, number] = [49.1, 26.0];
const C: [number, number] = [49.2, 26.0];
// About 1,000 km west of C.
const FAR: [number, number] = [39.2, 26.0];
const FAR_2: [number, number] = [39.1, 26.0];

describe("splitPipelineRoute", () => {
  it("keeps a line with closely spaced points whole, as a mapped route", () => {
    expect(splitPipelineRoute({ coordinates: [A, B, C], type: "LineString" })).toEqual({
      mapped: [[A, B, C]],
      unmapped: []
    });
  });

  it("treats a long line between two points as an unmapped join", () => {
    expect(splitPipelineRoute({ coordinates: [A, FAR], type: "LineString" })).toEqual({
      mapped: [],
      unmapped: [[A, FAR]]
    });
  });

  it("keeps a short two-point line as drawn", () => {
    expect(splitPipelineRoute({ coordinates: [A, B], type: "LineString" })).toEqual({ mapped: [[A, B]], unmapped: [] });
  });

  it("splits one line into its mapped stretches and the long joins between them", () => {
    expect(splitPipelineRoute({ coordinates: [A, B, C, FAR, FAR_2], type: "LineString" })).toEqual({
      mapped: [
        [A, B, C],
        [FAR, FAR_2]
      ],
      unmapped: [[C, FAR]]
    });
  });

  it("handles every part of a multi-part pipeline", () => {
    expect(
      splitPipelineRoute({
        coordinates: [
          [A, B],
          [C, FAR]
        ],
        type: "MultiLineString"
      })
    ).toEqual({ mapped: [[A, B]], unmapped: [[C, FAR]] });
  });
});
