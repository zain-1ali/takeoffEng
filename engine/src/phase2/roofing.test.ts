import { describe, expect, it } from "vitest";
import {
  computeRoofing,
  createRoofDefaults,
  createRoofXDefaults,
  roofCatalogue,
  roofLineGeometry,
  roofPlaneGeometry,
  ROOF_RESOURCES,
} from "./roofing.js";
import type {
  RoofAdd,
  RoofingProjectLike,
  RoofType,
} from "./roofing-types.js";

function fixture(mode: "simple" | "complex"): RoofingProjectLike {
  const defaults = createRoofDefaults();
  return {
    roofMode: mode,
    levels: [{ id: "ground" }, { id: "top" }],
    types: { roof: defaults.types },
    pl: { roof: defaults.placements },
    roofx: createRoofXDefaults(defaults.types),
  };
}

function quantities(project: RoofingProjectLike): Record<string, number> {
  const result: Record<string, number> = {};
  const add: RoofAdd = (_context, code, times, d1, d2, d3): void => {
    const quantity = times * (d1 ?? 1) * (d2 ?? 1) * (d3 ?? 1);
    if (Number.isFinite(quantity) && Math.abs(quantity) >= 1e-9) {
      result[code] = (result[code] ?? 0) + quantity;
    }
  };
  computeRoofing({ project, add, kinds: ["roof"] });
  return result;
}

describe("phase 2 roofing", () => {
  it("matches the specified complex geometry checks", () => {
    const type: RoofType = createRoofDefaults().types[0]!;
    const hip = roofLineGeometry(
      { id: "h", kind: "Hip", roof: type.id, len: 8.49, on: "Plan", p1: "", p2: "", no: 1 },
      type,
    );
    const valley = roofLineGeometry(
      { id: "v", kind: "Valley", roof: type.id, len: 5.66, on: "Plan", p1: "", p2: "", no: 1 },
      type,
    );
    const plane = roofPlaneGeometry(
      { id: "p", roof: type.id, shape: "Trapezium", a: 24, b: 12, h: 6, pitch: "", no: 1 },
      type,
    );

    expect(Math.abs(hip.trueLength - 8.84)).toBeLessThan(0.01);
    expect(Math.abs(valley.trueLength - 5.90)).toBeLessThan(0.01);
    expect(plane.planArea).toBe(108);
    expect(plane.slopeArea).toBeCloseTo(116.9, 1);
  });

  it("measures only the selected roof method", () => {
    const simple = quantities(fixture("simple"));
    const complex = quantities(fixture("complex"));

    expect(simple.RFVAL_RF1).toBeUndefined();
    expect(simple.RFSTS_ST1).toBeUndefined();
    expect(simple.RFCOV_RF1).toBeGreaterThan(0);
    expect(complex.RFVAL_RF1).toBeGreaterThan(0);
    expect(complex.RFSTS_ST1).toBe(1_260);
    expect(complex.RFSTEEL_RF1).toBeUndefined();
    expect(complex.RFTRUSS_RF3_S40).toBeUndefined();
  });

  it("deducts only openings over one square metre", () => {
    const project = fixture("complex");
    const totals = quantities(project);
    const withoutOpenings = fixture("complex");
    withoutOpenings.roofx!.openings = [];
    const gross = quantities(withoutOpenings);

    expect(gross.RFCOV_RF1! - totals.RFCOV_RF1!).toBeCloseTo(5.76, 10);
  });

  it("provides unique catalogue codes and all R01–R33 resources", () => {
    const entries = roofCatalogue(fixture("complex"));
    const codes = entries.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(ROOF_RESOURCES.map((resource) => resource.code)).toEqual(
      Array.from({ length: 33 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`),
    );
  });
});
