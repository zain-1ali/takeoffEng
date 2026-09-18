import { describe, expect, it } from "vitest";
import { nextResourceCode, parseCsv, parseCustomRates } from "./helpers.js";

describe("pricing helpers", () => {
  it("parses CSV with quoted commas", () => {
    const rows = parseCsv('code,name\nL01,"Mason, skilled"\n');
    expect(rows[1]).toEqual(["L01", "Mason, skilled"]);
  });

  it("reads prototype custom rate lines", () => {
    const custom = parseCustomRates({
      custom: { CPAD: { lines: [{ r: "L01", q: "2*0.5", note: "gang" }] } },
    });
    expect(custom.CPAD?.lines[0]).toMatchObject({ resourceCode: "L01", quantity: 1, note: "gang" });
  });

  it("allocates the next resource code in a category", () => {
    expect(nextResourceCode(["M01", "M02"], "Material")).toBe("M03");
    expect(nextResourceCode(["S01"], "Subcontract")).toBe("S02");
  });
});
