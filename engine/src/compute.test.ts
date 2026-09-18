import { describe, expect, it } from "vitest";
import { catalogue } from "./catalogue";
import { compute } from "./compute";
import { createMultiStoreyExample } from "./fixtures";

const round = (value: number, digits = 6): number =>
  Number(value.toFixed(digits));

describe("building structural engine", () => {
  it("matches the prototype multi-storey structural snapshot", () => {
    const result = compute(createMultiStoreyExample());
    const quantities = Object.fromEntries(
      Object.entries(result.tot)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, quantity]) => [code, round(quantity)]),
    );

    expect({
      quantities,
      concrete: round(result.concrete),
      steelKg: round(result.steelKg),
      formwork: round(result.formwork),
      floorArea: round(result.floorArea),
      measuredItems: result.items.length,
      barMarks: result.bars.length,
      warnings: result.warn,
    }).toMatchSnapshot();
  });

  it("balances building excavation against backfill and disposal", () => {
    const result = compute(createMultiStoreyExample());
    const excavation = Object.entries(result.tot)
      .filter(([code]) => /^EXC/.test(code))
      .reduce((sum, [, quantity]) => sum + quantity, 0);

    expect(excavation).toBeCloseTo(
      (result.tot.BFL ?? 0) + (result.tot.DSP ?? 0),
      10,
    );
  });

  it("produces finite quantities and unique catalogue codes", () => {
    const project = createMultiStoreyExample();
    const result = compute(project);
    const entries = catalogue(project);
    const codes = entries.map(({ code }) => code);

    expect(result.items.every(({ q }) => Number.isFinite(q))).toBe(true);
    expect(result.bars.every(({ kg }) => Number.isFinite(kg))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
    expect(
      Object.keys(result.tot).every((code) => codes.includes(code)),
    ).toBe(true);
  });

  it("reports invalid structural geometry and spacing once", () => {
    const project = createMultiStoreyExample();
    project.types.pad[0]!.sb = 2_000;
    project.types.pad[0]!.bxs = 20;
    project.pl.wall[0]!.op = 1_000;
    const result = compute(project);

    expect(result.warn).toContain("F1: stub is larger than its pad footing.");
    expect(result.warn).toContain("F1: spacing 20 mm is outside 50–450 mm.");
    expect(result.warn).toContain("W1: openings are larger than the wall area.");
    expect(new Set(result.warn).size).toBe(result.warn.length);
  });

  it("limits a single-storey project to its first level", () => {
    const project = createMultiStoreyExample();
    project.btype = "single";
    const result = compute(project);

    expect(result.levels).toHaveLength(1);
    expect(result.items.filter(({ lvl }) => lvl >= 0).every(({ lvl }) => lvl === 0))
      .toBe(true);
  });

  it("omits levelled frame work for foundations-only projects", () => {
    const project = createMultiStoreyExample();
    project.btype = "foundation";
    const result = compute(project);

    expect(result.levels).toHaveLength(0);
    expect(result.tot.CCOL).toBeUndefined();
    expect(result.tot.CBEAM).toBeUndefined();
    expect(result.tot.CSLAB).toBeUndefined();
    expect(result.floorArea).toBe(520);
  });
});
