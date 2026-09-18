import { describe, expect, it } from "vitest";
import { ProblemError } from "../common/problem.js";
import { assertNumericFormulas } from "./formulas.js";

describe("numeric formula validation", () => {
  it("accepts numbers, empty strings, and engine formulas", () => {
    expect(() => assertNumericFormulas({
      L: 1.8,
      W: "1.8*2",
      D: "20*15+4*2.5",
      note: "",
      extra: "",
    })).not.toThrow();
  });

  it("skips labels and other non-numeric keys", () => {
    expect(() => assertNumericFormulas({
      mark: "Pad F1 hello",
      name: "not a formula",
      mesh: "A193",
      topMode: "supports",
      L: "3.0",
      ra: { custom: { CPAD: { lines: [{ resourceCode: "L01", r: "L01", quantity: "2*0.5", note: "gang" }] } } },
    })).not.toThrow();
  });

  it("rejects invalid numeric strings with a path", () => {
    try {
      assertNumericFormulas({ types: { pad: [{ L: "DROP TABLE" }] } });
      throw new Error("expected invalid_formula");
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemError);
      const problem = error as ProblemError;
      expect(problem.status).toBe(422);
      expect(problem.type).toBe("invalid_formula");
      expect(problem.extras.path).toBe("stateJson.types.pad[0].L");
    }
  });
});
