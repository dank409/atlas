import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "./StatusBar";

const BASE_PROPS = { hasError: false, isLoading: false, totalAssetCount: 908, visibleAssetCount: 471 };

describe("StatusBar", () => {
  it("says what the app is, how much is showing and whose data it is", () => {
    render(<StatusBar {...BASE_PROPS} />);

    expect(screen.getByText("MIDDLE EAST OIL & GAS INFRASTRUCTURE")).toBeInTheDocument();
    expect(screen.getByText("SHOWING 471 OF 908 ASSETS")).toBeInTheDocument();
    expect(screen.getByText("DATA: GLOBAL ENERGY MONITOR · EDF OGIM · OPENSTREETMAP")).toBeInTheDocument();
  });

  it("shows a loading label until the data arrives", () => {
    render(<StatusBar {...BASE_PROPS} isLoading />);

    expect(screen.getByText("LOADING DATA")).toBeInTheDocument();
  });

  it("reports a failed load in preference to the loading label", () => {
    render(<StatusBar {...BASE_PROPS} hasError isLoading />);

    expect(screen.getByText("DATA LOAD FAILED")).toBeInTheDocument();
  });
});
