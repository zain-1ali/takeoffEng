import { createCompleteBuildingExample, createRoadDefaults, createBridgeDefaults } from "@takeoff/engine";
import { describe, expect, it } from "vitest";
import {
  excavationBalance,
  excavationQty,
  filterBars,
  groupBoq,
  numberMap,
  optionalNumber,
  unitCost,
} from "./reportData.js";
import { runProject } from "../../editor/runProject.js";

describe("report helpers", () => {
  it("parses manual rates and optional percents", () => {
    expect(numberMap({ CPAD: "12.5", skip: "", blank: null })).toEqual({ CPAD: 12.5 });
    expect(optionalNumber("")).toBeUndefined();
    expect(optionalNumber("5")).toBe(5);
  });

  it("computes building unit cost per floor area", () => {
    const bundle = runProject(createCompleteBuildingExample());
    const unit = unitCost(createCompleteBuildingExample(), bundle.result, bundle.totals.total);
    expect(unit?.[1]).toBe("per m² of floor and slab");
    expect(unit?.[0]).toBeCloseTo(bundle.totals.total / bundle.result.floorArea, 3);
  });

  it("computes road unit cost per km", () => {
    const project = createRoadDefaults();
    const bundle = runProject(project);
    const unit = unitCost(project, bundle.result, bundle.totals.total);
    expect(unit?.[1]).toBe("per km");
    expect(unit?.[0]).toBeGreaterThan(0);
  });

  it("computes bridge unit cost per m² of deck", () => {
    const project = createBridgeDefaults();
    const bundle = runProject(project);
    const unit = unitCost(project, bundle.result, bundle.totals.total);
    expect(unit?.[1]).toBe("per m² of deck");
  });

  it("groups BOQ rows into bills", () => {
    const bills = groupBoq(runProject(createCompleteBuildingExample()).boq.rows);
    expect(bills.length).toBeGreaterThan(1);
    expect(bills[0]?.title).toBeTruthy();
    expect(bills[0]?.rows.length).toBeGreaterThan(0);
  });

  it("filters bars by element", () => {
    const result = runProject(createCompleteBuildingExample()).result;
    const element = result.bars[0]?.el ?? "Columns";
    const filtered = filterBars(result.bars, result.levels, element, "");
    expect(filtered.every((bar) => bar.el === element)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("reads excavation quantities", () => {
    const result = runProject(createCompleteBuildingExample()).result;
    expect(excavationQty(result)).toBeGreaterThan(0);
    expect(Number.isFinite(excavationBalance(result))).toBe(true);
  });
});
