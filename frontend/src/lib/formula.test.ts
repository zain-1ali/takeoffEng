import { describe, expect, it } from "vitest";
import { evalExpr, n } from "./expr.js";
import { formulaStatus } from "./formula.js";

describe("calculator inputs", () => {
  it("evaluates the prototype formula cases", () => {
    expect(n("2.4*3+1.2")).toBeCloseTo(8.4);
    expect(n("(6-0.3)*2")).toBeCloseTo(11.4);
    expect(n("12/4")).toBe(3);
    expect(n("2x3")).toBe(6);
    expect(n("2×3÷4")).toBe(1.5);
    expect(n("20*15+4*2.5")).toBe(310);
    expect(n("200*5%")).toBe(10);
    expect(n("15%")).toBe(15);
    expect(evalExpr("4*")).toBeNaN();
  });

  it("shows a green badge for a valid formula and check formula when invalid", () => {
    expect(formulaStatus("20*15+4*2.5").badge).toBe("= 310.00");
    expect(formulaStatus("4*").badge).toBe("check formula");
    expect(formulaStatus("1.8").badge).toBeNull();
  });
});
