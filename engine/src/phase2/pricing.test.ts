import { describe, expect, it } from "vitest";
import { catalogue } from "../catalogue.js";
import { compute } from "../compute.js";
import { createMultiStoreyExample } from "../fixtures.js";
import { boqRows, boqTotals } from "./boq.js";
import { analyse, stdRecipe } from "./pricing.js";
import {
  allDefaultResources,
  finResourcesEnsure,
  raDefaults,
} from "./resources.js";
import type { PricingContext } from "./pricing-types.js";

function context(): PricingContext {
  const project = createMultiStoreyExample();
  return { project, resources: allDefaultResources() };
}

describe("phase 2 resource databank", () => {
  it("seeds every prototype resource in ensure order", () => {
    const resources = allDefaultResources();
    expect(raDefaults()).toHaveLength(67);
    expect(resources).toHaveLength(200);
    expect(resources[0]?.code).toBe("L01");
    expect(resources.at(-1)?.code).toBe("R33");
    expect(new Set(resources.map(({ code }) => code)).size).toBe(resources.length);
  });

  it("does not replace an existing resource", () => {
    const existing = [{ ...raDefaults()[0]!, rate: 99 }];
    expect(finResourcesEnsure(existing)[0]?.rate).toBe(99);
  });
});

describe("phase 2 pricing", () => {
  it("ports structural recipe quantities and produces an analysed rate", () => {
    const pricing = context();
    const recipe = stdRecipe("CPAD", pricing);
    expect(recipe.family).toBe("In-situ concrete");
    expect(recipe.lines.find((line) => line.resourceCode === "M01")?.quantity)
      .toBe(7.14);
    const analysis = analyse("CPAD", pricing);
    expect(analysis.missing).toEqual([]);
    expect(analysis.rate).toBeGreaterThan(0);
    expect(analysis.rate).toBe(
      Math.round((analysis.direct + analysis.overheads + analysis.profit) * 100) / 100,
    );
  });

  it("builds BOQ rows and exact contingency/tax totals", () => {
    const pricing = context();
    const result = compute(pricing.project);
    const entries = catalogue(pricing.project);
    const rows = boqRows(result, entries, pricing);
    const totals = boqTotals(result, entries, pricing, {
      contingencyPct: 5,
      taxPct: 18,
    });
    expect(rows.some((row) => "code" in row && row.code === "CPAD")).toBe(true);
    expect(totals.contingency).toBeCloseTo(totals.subtotal * .05);
    expect(totals.tax).toBeCloseTo((totals.subtotal + totals.contingency) * .18);
    expect(totals.total).toBeCloseTo(
      totals.subtotal + totals.contingency + totals.tax,
    );
  });
});
