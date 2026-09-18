import { describe, expect, it } from "vitest";
import { evalExpr, isExpr, n } from "./expression";

describe("safe numeric expression parser", () => {
  it.each([
    ["2.4*3+1.2", 8.4],
    ["(6-0.3)*2", 11.4],
    ["12/4", 3],
    ["2x3", 6],
    ["2×3÷4", 1.5],
    ["3-1-1", 1],
    ["-2+5", 3],
    ["2,5*2", 5],
    ["2(3+1)", 8],
    ["2^3", 8],
    ["15%", 15],
    ["200*5%", 10],
    ["1/0", 0],
    ["4*", 0],
    ["abc", 0],
    ["600 × 600 mm", 600],
  ])("n(%j) = %s", (input, expected) => {
    expect(n(input)).toBeCloseTo(expected, 10);
  });

  it("detects formulas but not plain values", () => {
    expect(isExpr("20*15+4*2.5")).toBe(true);
    expect(isExpr("-2+5")).toBe(true);
    expect(isExpr("15%")).toBe(false);
    expect(isExpr("12.5")).toBe(false);
    expect(isExpr("600 × 600 mm")).toBe(false);
  });

  it("rejects unsafe, oversized, and invalid expressions", () => {
    expect(Number.isNaN(evalExpr("1/0"))).toBe(true);
    expect(Number.isNaN(evalExpr("4*"))).toBe(true);
    expect(isExpr("process.exit()")).toBe(false);
    expect(n(`${"1+".repeat(121)}1`)).toBe(0);
  });
});
