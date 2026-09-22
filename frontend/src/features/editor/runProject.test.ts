import {
  allDefaultResources,
  createBridgeDefaults,
  createCompleteBuildingExample,
  createRoadDefaults,
} from "@takeoff/engine";
import { describe, expect, it } from "vitest";
import { roundSummary, runProject } from "./runProject.js";

describe("engine runner parity", () => {
  it("matches prototype seed summaries", () => {
    expect(roundSummary(runProject(createCompleteBuildingExample()).totals)).toEqual({
      items: 1153,
      bars: 270,
      concrete: 1049.798,
      steelKg: 101306.946,
      formwork: 5721.563,
      floorArea: 3511.2,
      boqTotal: 954208.971,
    });
    expect(roundSummary(runProject(createRoadDefaults()).totals)).toMatchObject({
      items: 68,
      bars: 4,
      concrete: 361.871,
      steelKg: 1341.899,
      formwork: 125.12,
      boqTotal: 1076440.559,
    });
    expect(roundSummary(runProject(createBridgeDefaults()).totals)).toMatchObject({
      items: 96,
      bars: 46,
      concrete: 630.104,
      steelKg: 67973.804,
      formwork: 2213.14,
      boqTotal: 352822.306,
    });
  });

  it("applies document contingency and tax overrides", () => {
    const base = runProject(createCompleteBuildingExample());
    const zeroTax = runProject({
      ...createCompleteBuildingExample(),
      report: { cont: 5, vat: 0 },
    } as ReturnType<typeof createCompleteBuildingExample> & { report: { cont: number; vat: number } });
    expect(zeroTax.totals.tax).toBe(0);
    expect(zeroTax.totals.total).toBeLessThan(base.totals.total);
    expect(zeroTax.split.some((row) => row.value > 0)).toBe(true);
  });

  it("prices a project at zero when the databank has no rates", () => {
    const project = createCompleteBuildingExample();
    const empty = runProject({ ...project, resources: [] } as typeof project & { resources: [] });
    expect(empty.totals.subtotal).toBe(0);
    expect(empty.totals.total).toBe(0);
    expect(empty.boq.items.every((row) => row.rate === 0 || row.amount === 0)).toBe(true);
  });

  it("uses org resources, custom recipes and tools from the document", () => {
    const project = createCompleteBuildingExample();
    const base = runProject(project);
    const expensive = allDefaultResources().map((row) => (
      row.code === "M01" ? { ...row, rate: row.rate * 2 } : row
    ));
    const bumped = runProject({ ...project, resources: expensive } as typeof project & { resources: typeof expensive });
    expect(bumped.totals.total).toBeGreaterThan(base.totals.total);
    const tools = runProject({ ...project, ra: { tools: 40, oh: 10, profit: 10 } } as typeof project & { ra: { tools: number; oh: number; profit: number } });
    expect(tools.totals.total).toBeGreaterThan(base.totals.total);
    const custom = runProject({
      ...project,
      ra: { custom: { CPAD: { lines: [{ resourceCode: "L01", quantity: 0, note: "" }] } } },
    } as typeof project & { ra: { custom: Record<string, { lines: { resourceCode: string; quantity: number; note: string }[] }> } });
    expect(custom.totals.total).toBeLessThan(base.totals.total);
  });
});
