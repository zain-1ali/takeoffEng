import { describe, expect, it } from "vitest";
import { bomRows } from "./bom.js";
import { boqTotals } from "./boq.js";
import { fullCatalogue } from "./catalogue.js";
import { createBridgeDefaults, createRoadDefaults } from "./civil.js";
import { createCompleteBuildingExample } from "./full-fixtures.js";
import { computeFullProject, type FullProject } from "./full.js";
import { analyse } from "./pricing.js";
import { allDefaultResources } from "./resources.js";

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function summary(project: FullProject) {
  const result = computeFullProject(project);
  const entries = fullCatalogue(project);
  const pricing = {
    project,
    resources: allDefaultResources(),
    recipeTypes: project.types,
    roofTrusses: "roofx" in project ? project.roofx?.trusses : undefined,
  };
  const boq = boqTotals(result, entries, pricing);
  const bom = bomRows({ ...pricing, result });
  return {
    result,
    entries,
    pricing,
    value: {
      items: result.items.length,
      bars: result.bars.length,
      codes: Object.keys(result.tot).length,
      concrete: round(result.concrete),
      steelKg: round(result.steelKg),
      formwork: round(result.formwork),
      floorArea: round(result.floorArea),
      boqItems: boq.items.length,
      bomItems: bom.filter((row) => "code" in row).length,
      boqTotal: round(boq.total),
    },
  };
}

describe("complete Phase 2 engine", () => {
  it("locks prototype seed summaries for every project mode", () => {
    expect(summary(createCompleteBuildingExample()).value).toMatchInlineSnapshot(`
      {
        "bars": 270,
        "bomItems": 119,
        "boqItems": 151,
        "boqTotal": 954208.971,
        "codes": 151,
        "concrete": 1049.798,
        "floorArea": 3511.2,
        "formwork": 5721.563,
        "items": 1153,
        "steelKg": 101306.946,
      }
    `);
    expect(summary(createRoadDefaults()).value).toMatchInlineSnapshot(`
      {
        "bars": 4,
        "bomItems": 31,
        "boqItems": 37,
        "boqTotal": 1076440.559,
        "codes": 37,
        "concrete": 361.871,
        "floorArea": 0,
        "formwork": 125.12,
        "items": 68,
        "steelKg": 1341.899,
      }
    `);
    expect(summary(createBridgeDefaults()).value).toMatchInlineSnapshot(`
      {
        "bars": 46,
        "bomItems": 20,
        "boqItems": 47,
        "boqTotal": 352822.306,
        "codes": 47,
        "concrete": 630.104,
        "floorArea": 0,
        "formwork": 2213.14,
        "items": 96,
        "steelKg": 67973.804,
      }
    `);
  });

  it("catalogues and prices every measured prototype code", () => {
    for (const project of [
      createCompleteBuildingExample(),
      createRoadDefaults(),
      createBridgeDefaults(),
    ]) {
      const { result, entries, pricing } = summary(project);
      const catalogueCodes = new Set(entries.map(({ code }) => code));
      for (const [code, quantity] of Object.entries(result.tot)) {
        if (!(quantity > 0)) continue;
        expect(catalogueCodes.has(code), `${project.btype}: ${code}`).toBe(true);
        const rate = analyse(code, pricing);
        expect(rate.missing, `${project.btype}: ${code}`).toEqual([]);
        expect(rate.rate, `${project.btype}: ${code}`).toBeGreaterThan(0);
      }
    }
  });
});
