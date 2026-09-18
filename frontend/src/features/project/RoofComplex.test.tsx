/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { RoofPlanSketch } from "./RoofComplex.js";

describe("RoofPlanSketch", () => {
  it("labels ridge, hip, valley, verge, eaves and opening", () => {
    render(<RoofPlanSketch />);
    expect(screen.getByRole("img", { name: "Plan of an L-shaped roof showing line types" })).toBeInTheDocument();
    expect(screen.getByText("Ridge")).toBeInTheDocument();
    expect(screen.getByText("Valley")).toBeInTheDocument();
    expect(screen.getByText("Eaves")).toBeInTheDocument();
  });
});
